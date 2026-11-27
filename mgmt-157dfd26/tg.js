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
    const row = (g, c) => (rows[g + '|' + c] = rows[g + '|' + c] || {group: g, channel: c, target: null, toDate: null, done: 0, today: 0});
    let frac, daysLeft, label, start;
    if (bfs) {
      start = '2026-11-27'; label = 'BFS 2026 (27 Nov – 6 Dec), ₹7 Cr plan';
      const lyh = ok('ly_hour'), lm = ok('ly_meta');
      const sd = Math.round((Date.parse(today) - Date.parse('2026-11-27')) / 864e5) + 1;
      if (lyh && lm && lm[0]) { const day = lyh.filter((r) => +r.day === sd); const all = day.reduce((a, r) => a + (+r.ly_total || 0), 0); const upto = day.filter((r) => r.hour <= lm[0].last_hour).reduce((a, r) => a + (+r.ly_total || 0), 0); frac = all ? upto / all : hr / 24; } else frac = hr / 24;
      const dates = [...new Set(T.filter((r) => r.period === 'bfs').map((r) => r.date))].sort();
      daysLeft = dates.filter((d) => d > today).length;
      T.filter((r) => r.period === 'bfs').forEach((r) => { const x = row(r.group, r.channel); x.target = (x.target || 0) + r.target_lakh; if (r.date < today) x.toDate = (x.toDate || 0) + r.target_lakh; else if (r.date === today) x.toDate = (x.toDate || 0) + r.target_lakh * frac; });
    } else {
      const m = today.slice(0, 7); start = m + '-01'; label = 'Month to date vs the ₹45 Cr FY26-27 plan';
      const dim = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(), dom = +today.slice(8, 10);
      frac = (dom - 1 + hr / 24) / dim; daysLeft = dim - dom;
      T.filter((r) => r.period === 'month' && r.date === m).forEach((r) => { const x = row(r.group, r.channel); x.target = r.target_lakh; x.toDate = r.target_lakh * frac; });
    }
    D.filter((r) => r.date >= start).forEach((r) => { row(group(r.channel, r.type), r.channel).done += +r.net_lakh || 0; });
    S.forEach((r) => { row(group(r.channel, r.type), r.channel).today += +r.net_lakh || 0; });
    // group totals (BFS marketplaces have only a group target, held on the 'Marketplaces' row)
    const out = [];
    let tot = {group: 'Total', channel: 'Total', target: 0, toDate: 0, ach: 0, kind: 'total'};
    ORDER.forEach((g) => {
      const kids = Object.values(rows).filter((x) => x.group === g && x.channel !== 'Marketplaces');
      const own = rows[g + '|Marketplaces'];
      const sum = (k) => kids.reduce((a, x) => a + (x[k] || 0), 0);
      const gt = {group: g, channel: LABEL[g], kind: 'group', target: own ? own.target : (kids.some((x) => x.target != null) ? sum('target') : null), toDate: own ? own.toDate : (kids.some((x) => x.toDate != null) ? sum('toDate') : null), ach: sum('done') + sum('today'), todayAch: sum('today')};
      out.push(gt);
      if (g !== 'Website') kids.sort((a, b) => (b.target || 0) - (a.target || 0) || (b.done + b.today) - (a.done + a.today)).forEach((x) => out.push({group: g, channel: x.channel, kind: 'row', target: x.target, toDate: x.toDate, ach: x.done + x.today, todayAch: x.today}));
      tot.target += gt.target || 0; tot.toDate += gt.toDate || 0; tot.ach += gt.ach;
    });
    out.push(tot);
    out.forEach((r) => { r.pctToDate = r.toDate ? r.ach / r.toDate : null; r.pctFull = r.target ? r.ach / r.target : null; r.need = r.target != null ? (daysLeft > 0 ? Math.max(0, r.target - r.ach) / daysLeft : null) : null; });
    return {rows: out, label, bfs, today, daysLeft, frac, asOf};
  };
  dash.draw('tg-note', (el) => {
    const c = window.tgCalc(); if (!c) { el.textContent = '—'; return; }
    el.textContent = c.label + '. ₹ lakh, net sales excl. GST (online by order date, stores by bill date). Target to date = finished days in full plus ' + (c.bfs ? Math.round(c.frac * 100) + '% of today\'s target (the share of last year\'s same sale day that had come in by this hour)' : 'the share of the month gone') + '. Needed per day = what is left of the full target ÷ ' + c.daysLeft + ' day' + (c.daysLeft === 1 ? '' : 's') + ' after today.' + (c.bfs ? ' Marketplace targets split the ₹20 L by each marketplace\'s share of Sep–Oct 2026 sales.' : '');
  });
  dash.draw('tg-body', (tb) => {
    const c = window.tgCalc(); tb.replaceChildren();
    if (!c) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 7; td.className = 'l'; td.textContent = '—'; return; }
    c.rows.forEach((r) => {
      const tr = tb.insertRow(); if (r.kind !== 'row') tr.className = 'tot';
      const cell = (t, cls) => { const td = tr.insertCell(); td.textContent = t; if (cls) td.className = cls; return td; };
      cell((r.kind === 'row' ? '   ' : '') + r.channel, 'l');
      cell(N2(r.target)); cell(N2(r.toDate)); cell(N2(r.ach));
      const p = cell(PC(r.pctToDate)); if (r.pctToDate != null) p.classList.add(r.pctToDate >= 1 ? 'ok' : r.pctToDate >= 0.8 ? 'warn' : 'bad');
      cell(PC(r.pctFull)); cell(N2(r.need));
    });
  });
  dash.draw('tg-k', (el) => {
    const c = window.tgCalc(); const t = c ? c.rows.find((r) => r.kind === 'total') : null; const f = el.dataset.f;
    if (!t) { el.textContent = '—'; return; }
    el.textContent = f === 'ach' ? N2(t.ach) : f === 'pct' ? PC(t.pctToDate) : f === 'full' ? PC(t.pctFull) + ' of ₹' + N2(t.target) + ' L' : f === 'need' ? N2(t.need) : '—';
  });
})();
