// Target vs achievement by channel and store.
// BFS (27 Nov – 6 Dec 2026): ₹7 Cr plan from BFS_2026_Targets_7Cr.xlsx, day-wise per channel (chan_target period 'bfs').
// After BFS: the agreed ₹45 Cr FY26-27 plan, monthly per channel (chan_target period 'month'), pro-rated to date.
// Achieved = finished days from chan_daily + today's live sales (sales dataset). "Expected by now" for today uses
// last year's hourly sales curve for the same sale day (ly_hour) during BFS, else the share of the day gone.
(function () {
  const N2 = (v) => v == null || !isFinite(v) ? '—' : v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const PC = (v) => v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%';
  const MKT = ['Myntra', 'Nykaa Fashion', 'Tata CLiQ', 'Amazon'];
  const group = (c, type) => c === 'Shopify' ? 'Website' : MKT.includes(c) || (type === 'Online' && c !== 'Shopify') ? 'Marketplaces' : 'Stores';
  const ORDER = ['Website', 'Stores', 'Marketplaces'];
  const LABEL = {Website: 'Website (Shopify)', Stores: 'Stores', Marketplaces: 'Marketplaces'};
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : null; };
  window.tgCalc = () => {
    const T = ok('chan_target'), S = ok('sales'), sm = ok('summary');
    if (!T || !S || !sm || !sm[0]) return null;
    const asOf = String(sm[0].as_of || ''), today = asOf.slice(0, 10), hr = +asOf.slice(11, 13) + (+asOf.slice(14, 16) || 0) / 60;
    const bfs = today >= '2026-11-27' && today <= '2026-12-06';
    const D = (ok('chan_daily') || []).filter((r) => r.date && r.date < today);
    const rows = {};
    const row = (g, c) => (rows[g + '|' + c] = rows[g + '|' + c] || {group: g, channel: c, target: null, toDate: null, dayT: null, done: 0, today: 0});
    let frac, daysLeft, label, start;
    if (bfs) {
      start = '2026-11-27'; label = 'BFS 2026 (27 Nov – 6 Dec), ₹7 Cr plan';
      const lyh = ok('ly_hour'), lm = ok('ly_meta');
      const sd = Math.round((Date.parse(today) - Date.parse('2026-11-27')) / 864e5) + 1;
      if (lyh && lm && lm[0]) { const day = lyh.filter((r) => +r.day === sd); const all = day.reduce((a, r) => a + (+r.ly_total || 0), 0); const upto = day.filter((r) => r.hour <= lm[0].last_hour).reduce((a, r) => a + (+r.ly_total || 0), 0); frac = all ? upto / all : hr / 24; } else if (lm && lm[0] && lm[0].ly_frac != null) frac = +lm[0].ly_frac; else frac = hr / 24;
      const dates = [...new Set(T.filter((r) => r.period === 'bfs').map((r) => r.date))].sort();
      daysLeft = dates.filter((d) => d > today).length;
      T.filter((r) => r.period === 'bfs').forEach((r) => { const x = row(r.group, r.channel); x.target = (x.target || 0) + r.target_lakh; if (r.date < today) x.toDate = (x.toDate || 0) + r.target_lakh; else if (r.date === today) { x.toDate = (x.toDate || 0) + r.target_lakh * frac; x.dayT = (x.dayT || 0) + r.target_lakh; } });
    } else {
      const m = today.slice(0, 7); start = m + '-01'; label = 'Month to date vs the ₹45 Cr FY26-27 plan';
      const dim = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(), dom = +today.slice(8, 10);
      frac = (dom - 1 + hr / 24) / dim; daysLeft = dim - dom;
      T.filter((r) => r.period === 'month' && r.date === m).forEach((r) => { const x = row(r.group, r.channel); x.target = r.target_lakh; x.toDate = r.target_lakh * frac; x.dayT = r.target_lakh / dim; });
    }
    D.filter((r) => r.date >= start).forEach((r) => { row(group(r.channel, r.type), r.channel).done += +r.net_lakh || 0; });
    S.forEach((r) => { row(group(r.channel, r.type), r.channel).today += +r.net_lakh || 0; });
    // group totals (BFS marketplaces have only a group target, held on the 'Marketplaces' row)
    const out = [];
    let tot = {group: 'Total', channel: 'Total', target: 0, toDate: 0, dayT: 0, ach: 0, todayAch: 0, kind: 'total'};
    ORDER.forEach((g) => {
      const kids = Object.values(rows).filter((x) => x.group === g && x.channel !== 'Marketplaces');
      const own = rows[g + '|Marketplaces'];
      const sum = (k) => kids.reduce((a, x) => a + (x[k] || 0), 0);
      const gt = {group: g, channel: LABEL[g], kind: 'group', target: own ? own.target : (kids.some((x) => x.target != null) ? sum('target') : null), toDate: own ? own.toDate : (kids.some((x) => x.toDate != null) ? sum('toDate') : null), dayT: own ? own.dayT : (kids.some((x) => x.dayT != null) ? sum('dayT') : null), ach: sum('done') + sum('today'), todayAch: sum('today')};
      out.push(gt);
      if (g !== 'Website') kids.sort((a, b) => (b.target || 0) - (a.target || 0) || (b.done + b.today) - (a.done + a.today)).forEach((x) => out.push({group: g, channel: x.channel, kind: 'row', target: x.target, toDate: x.toDate, dayT: x.dayT, ach: x.done + x.today, todayAch: x.today}));
      tot.target += gt.target || 0; tot.toDate += gt.toDate || 0; tot.dayT += gt.dayT || 0; tot.ach += gt.ach; tot.todayAch += gt.todayAch;
    });
    out.push(tot);
    out.forEach((r) => { r.pctToDate = r.toDate ? r.ach / r.toDate : null; r.pctFull = r.target ? r.ach / r.target : null; r.pctDay = r.dayT ? r.todayAch / r.dayT : null; r.need = r.target != null ? (daysLeft > 0 ? Math.max(0, r.target - r.ach) / daysLeft : null) : null; });
    return {rows: out, label, bfs, today, daysLeft, frac, asOf, start};
  };
  dash.draw('tg-note', (el) => {
    const c = window.tgCalc(); if (!c) { el.textContent = '—'; return; }
    el.textContent = c.label + '. Today = sales since midnight vs the full day target. ' + (c.bfs ? 'BFS till now = 27 Nov to this refresh.' : 'Month to date = 1st of the month to this refresh.') + ' ₹ lakh, net sales excl. GST (online by order date, stores by bill date). Target to date = finished days in full plus ' + (c.bfs ? Math.round(c.frac * 100) + '% of today\'s target (the share of last year\'s same sale day that had come in by this hour)' : 'the share of the month gone') + '. Needed per day = what is left of the full target ÷ ' + c.daysLeft + ' day' + (c.daysLeft === 1 ? '' : 's') + ' after today.' + (c.bfs ? ' Marketplace targets split the ₹20 L by each marketplace\'s share of Sep–Oct 2026 sales.' : '');
  });
  const cls = (v) => v == null ? '' : v >= 1 ? 'ok' : v >= 0.8 ? 'warn' : 'bad';
  const span = (c) => c.bfs ? 'BFS till now (27 Nov →)' : 'Month to date';
  dash.draw('tg-body', (tb) => {
    const c = window.tgCalc(); tb.replaceChildren();
    const th = tb.parentElement && tb.parentElement.tHead;
    if (th) { th.replaceChildren(); const r1 = th.insertRow(), r2 = th.insertRow();
      const h = (tr, t, o) => { const e = document.createElement('th'); e.textContent = t; if (o && o.l) e.className = 'l'; if (o && o.cs) e.colSpan = o.cs; if (o && o.rs) e.rowSpan = o.rs; if (o && o.c) e.style.textAlign = 'center'; tr.appendChild(e); };
      h(r1, 'Channel / store', {l: 1, rs: 2}); h(r1, 'Today', {cs: 3, c: 1}); h(r1, c ? span(c) : 'To date', {cs: 3, c: 1}); h(r1, c && c.bfs ? 'Whole BFS' : 'Whole month', {cs: 3, c: 1});
      ['Day target', 'Achieved', '% of day', 'Target till now', 'Achieved', '% till now', 'Full target', '% of full', 'Needed / day'].forEach((t) => h(r2, t));
      [...r2.children].forEach((e) => { e.style.top = '1.9em'; }); }
    if (!c) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 10; td.className = 'l'; td.textContent = '—'; return; }
    c.rows.forEach((r) => {
      const tr = tb.insertRow(); if (r.kind !== 'row') tr.className = 'tot';
      const cell = (t, k) => { const td = tr.insertCell(); td.textContent = t; if (k) td.classList.add(k); return td; };
      cell((r.kind === 'row' ? '   ' : '') + r.channel, 'l');
      cell(N2(r.dayT)); cell(N2(r.todayAch)); cell(PC(r.pctDay), cls(r.pctDay));
      cell(N2(r.toDate)); cell(N2(r.ach)); cell(PC(r.pctToDate), cls(r.pctToDate));
      cell(N2(r.target)); cell(PC(r.pctFull)); cell(N2(r.need));
    });
  });
  // Headline banner (Zuber, 28 Nov): the running BFS total since 27 Nov up to this refresh, plus each sale day.
  dash.draw('tg-banner', (el) => {
    const c = window.tgCalc(); el.replaceChildren(); if (!c) { el.textContent = '—'; return; }
    const T = ok('chan_target') || [], D = (ok('chan_daily') || []).filter((r) => r.date && r.date < c.today && r.date >= c.start);
    const tot = c.rows.find((r) => r.kind === 'total');
    const fmtD = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
    const tm = (() => { const d = new Date(c.asOf); return isNaN(d) ? c.asOf : d.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}); })();
    const L = (v) => '₹' + N2(v) + ' L';
    const h = document.createElement('div'); h.className = 'tg-bn-h';
    const k = document.createElement('div'); k.className = 'tg-bn-k'; k.textContent = (c.bfs ? 'BFS sales so far · 27 Nov 12:00 AM → ' : 'Month to date · ' + fmtD(c.start) + ' → ') + tm + ' (this refresh)';
    const v = document.createElement('div'); v.className = 'tg-bn-v'; v.textContent = L(tot.ach);
    const s = document.createElement('div'); s.className = 'tg-bn-s'; s.textContent = PC(tot.pctToDate) + ' of the target till now (' + L(tot.toDate) + ') · ' + PC(tot.pctFull) + ' of the full ' + (c.bfs ? 'BFS' : 'month') + ' target (' + L(tot.target) + ')';
    h.append(k, v, s); el.appendChild(h);
    if (!c.bfs) return;
    const days = [...new Set(T.filter((r) => r.period === 'bfs').map((r) => r.date))].sort().filter((d) => d <= c.today);
    const byD = {}; D.forEach((r) => { byD[r.date] = (byD[r.date] || 0) + (+r.net_lakh || 0); });
    const tgt = (d) => T.filter((r) => r.period === 'bfs' && r.date === d).reduce((a, r) => a + r.target_lakh, 0);
    const tb = document.createElement('table'); tb.className = 'tg-bn-t';
    const hr = tb.insertRow(); ['Sale day', 'Date', 'Net sales', 'Day target', '% of day', 'Running BFS total'].forEach((x, i) => { const th = document.createElement('th'); th.textContent = x; if (i < 2) th.className = 'l'; hr.appendChild(th); });
    let run = 0;
    days.forEach((d, i) => {
      const isT = d === c.today; const val = isT ? tot.todayAch : (byD[d] || 0); run += val; const dt = tgt(d); const p = dt ? val / dt : null;
      const r = tb.insertRow(); if (isT) r.className = 'now';
      [['Day ' + (i + 1), 'l'], [fmtD(d) + (isT ? ' (till ' + tm.split(', ').pop() + ')' : ''), 'l'], [L(val)], [L(dt)], [PC(p), cls(p)], [L(run)]].forEach(([x, k2]) => { const td = r.insertCell(); td.textContent = x; if (k2) td.classList.add(...k2.split(' ').filter(Boolean)); });
    });
    const w = document.createElement('div'); w.className = 'lv-tw'; w.appendChild(tb); el.appendChild(w);
  });
  dash.draw('tg-title', (el) => { const c = window.tgCalc(); el.textContent = c && !c.bfs ? 'Today and month to date: target vs achievement' : 'Today and BFS till now: target vs achievement'; });
  dash.draw('tg-tiles', (el) => {
    const c = window.tgCalc(); el.replaceChildren(); const t = c ? c.rows.find((r) => r.kind === 'total') : null;
    const tile = (k, v, s, pc) => { const d = document.createElement('div'); d.className = 'lv-tile'; const a = document.createElement('span'); a.className = 'k'; a.textContent = k; const b = document.createElement('span'); b.className = 'v' + (pc != null ? ' ' + cls(pc) : ''); b.textContent = v; const e = document.createElement('span'); e.className = 's'; e.textContent = s; d.append(a, b, e); el.appendChild(d); };
    if (!t) { tile('Target vs achievement', '—', ''); return; }
    const L = (v) => '₹' + N2(v) + ' L';
    tile('Today so far vs day target', PC(t.pctDay), L(t.todayAch) + ' of ' + L(t.dayT), t.pctDay);
    tile((c.bfs ? 'BFS till now (27 Nov →)' : 'Month to date') + ' vs target till now', PC(t.pctToDate), L(t.ach) + ' of ' + L(t.toDate), t.pctToDate);
    tile(c.bfs ? 'Whole BFS target (₹7 Cr plan)' : 'Whole month target', PC(t.pctFull), L(t.ach) + ' of ' + L(t.target));
    tile('Needed per day to hit the full target', L(t.need), c.daysLeft + ' day' + (c.daysLeft === 1 ? '' : 's') + ' left after today');
  });
  dash.draw('tg-k', (el) => {
    const c = window.tgCalc(); const t = c ? c.rows.find((r) => r.kind === 'total') : null; const f = el.dataset.f;
    if (!t) { el.textContent = '—'; return; }
    el.textContent = f === 'ach' ? N2(t.ach) : f === 'pct' ? PC(t.pctToDate) : f === 'full' ? PC(t.pctFull) + ' of ₹' + N2(t.target) + ' L' : f === 'need' ? N2(t.need) : '—';
  });
})();
