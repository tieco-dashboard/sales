// Run rate card at the top of the Marketing tab (Zuber, 28 Nov): current run rate vs the run rate needed to hit the target,
// per channel group, plus ad spend pace and the MER needed on the budget that is left. No cost data (safe for the team page).
// Uses window.tgCalc (tg.js) for targets/achieved and window.spBfs (spend.js) for spend. BFS: 27 Nov – 6 Dec; after BFS: month to date.
(function () {
  const N2 = (v) => v == null || !isFinite(v) ? '—' : v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const PC = (v) => v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%';
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : null; };
  const pace = () => {
    const c = window.tgCalc && window.tgCalc(); if (!c) return null;
    const hr = +String(c.asOf).slice(11, 13) + (+String(c.asOf).slice(14, 16) || 0) / 60;
    const todayFrac = c.bfs ? Math.max(0.02, c.frac) : Math.max(0.02, hr / 24);
    const finished = Math.round((Date.parse(c.today + 'T00:00:00') - Date.parse(c.start + 'T00:00:00')) / 864e5);
    const elapsed = finished + todayFrac, rem = c.daysLeft + (1 - todayFrac);
    const rows = c.rows.filter((r) => r.kind !== 'row').map((r) => {
      const cur = elapsed ? r.ach / elapsed : null, left = r.target != null ? Math.max(0, r.target - r.ach) : null, req = left != null && rem > 0 ? left / rem : null;
      const planRem = r.target != null && r.toDate != null && rem > 0 ? Math.max(0, r.target - r.toDate) / rem : null;
      const paceP = r.toDate ? r.ach / r.toDate : null, proj = paceP != null && r.target != null ? r.target * paceP : null;
      return {name: r.kind === 'total' ? 'Total' : r.channel, total: r.kind === 'total', target: r.target, ach: r.ach, paceP, cur, planRem, req, uplift: planRem && req != null ? req / planRem - 1 : null, proj, projPct: r.target ? proj / r.target : null};
    });
    return {c, rows, elapsed, rem, finished, todayFrac};
  };
  window.rrPace = pace;
  const cls = (v) => v == null ? '' : v >= 1 ? 'ok' : v >= 0.85 ? 'warn' : 'bad';
  dash.draw('rr-title', (el) => { const p = pace(); el.textContent = p && !p.c.bfs ? 'Run rate this month: where we stand' : 'BFS run rate: where we stand'; });
  dash.draw('rr-note', (el) => {
    const p = pace(); if (!p) { el.textContent = '—'; return; }
    const tm = (() => { const d = new Date(p.c.asOf); return isNaN(d) ? p.c.asOf : d.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}); })();
    el.textContent = '₹ lakh, net sales excl. GST, as of ' + tm + '. ' + (p.c.bfs ? 'Sale days gone: ' : 'Days gone: ') + p.elapsed.toFixed(1) + ' (' + p.finished + ' full day' + (p.finished === 1 ? '' : 's') + ' + ' + Math.round(p.todayFrac * 100) + '% of today' + (p.c.bfs ? ', by last year\'s hourly curve' : '') + '); days left incl. the rest of today: ' + p.rem.toFixed(1) + '. Current run rate = achieved ÷ days gone. Plan run rate = what the plan expects per day for the days left (the plan is front-loaded, so it falls day by day). Required = what is left of the target ÷ days left. Lift needed = required ÷ plan run rate − 1, i.e. how far above plan every remaining day must be. Projected = full target × achieved vs plan till now (current pace kept to the end).';
  });
  dash.draw('rr-body', (tb) => {
    const p = pace(); tb.replaceChildren(); if (!p) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 10; td.className = 'l'; td.textContent = '—'; return; }
    p.rows.forEach((r) => {
      const tr = tb.insertRow(); if (r.total) tr.className = 'tot';
      const cell = (t, k) => { const td = tr.insertCell(); td.textContent = t; if (k) td.classList.add(...k.split(' ').filter(Boolean)); };
      cell(r.name, 'l'); cell(N2(r.target)); cell(N2(r.ach)); cell(PC(r.paceP), cls(r.paceP)); cell(N2(r.cur)); cell(N2(r.planRem)); cell(N2(r.req));
      cell(r.uplift == null ? '—' : r.uplift <= 0 ? 'On track' : '+' + PC(r.uplift), r.uplift == null ? '' : r.uplift <= 0 ? 'ok' : r.uplift <= 0.15 ? 'warn' : 'bad');
      cell(N2(r.proj)); cell(PC(r.projPct), cls(r.projPct));
    });
  });
  dash.draw('rr-tiles', (el) => {
    const p = pace(); el.replaceChildren(); if (!p) return;
    const tile = (k, v, s, c2) => { const d = document.createElement('div'); d.className = 'lv-tile'; const a = document.createElement('span'); a.className = 'k'; a.textContent = k; const b = document.createElement('span'); b.className = 'v' + (c2 ? ' ' + c2 : ''); b.textContent = v; const e = document.createElement('span'); e.className = 's'; e.textContent = s; d.append(a, b, e); el.appendChild(d); };
    const web = p.rows.find((r) => /Website/.test(r.name)) || {}, tot = p.rows.find((r) => r.total) || {};
    tile('Website: required vs plan run rate', '₹' + N2(web.req) + ' / ₹' + N2(web.planRem) + ' L a day', web.uplift == null ? '' : web.uplift <= 0 ? 'On track for ₹' + N2(web.target) + ' L' : '+' + PC(web.uplift) + ' above plan every day left to reach ₹' + N2(web.target) + ' L', web.uplift == null ? '' : web.uplift <= 0 ? 'ok' : web.uplift <= 0.15 ? 'warn' : 'bad');
    tile('Total: required vs plan run rate', '₹' + N2(tot.req) + ' / ₹' + N2(tot.planRem) + ' L a day', 'At current pace (' + PC(tot.paceP) + ' of plan) BFS ends at ₹' + N2(tot.proj) + ' L = ' + PC(tot.projPct) + ' of ₹' + N2(tot.target) + ' L', cls(tot.projPct));
    if (!p.c.bfs || !window.spBfs) return;
    const spent = window.spBfs('All', 'spend'), budget = window.spBfs('All', 'budget'), mer = window.spBfs('All', 'mer'), merNeed = window.spBfs('All', 'mer_needed');
    const daily = ok('spend_daily') || [], ads = ok('ads') || [];
    const saleSpend = daily.filter((r) => r.date >= p.c.start && r.date < p.c.today).reduce((a, r) => a + (+r.meta_actual || 0) + (+r.google_actual || 0), 0) + ads.reduce((a, r) => a + (+r.spend_today || 0), 0);
    const curSpend = p.elapsed ? saleSpend / p.elapsed : null, left = budget != null && spent != null ? budget - spent : null, reqSpend = left != null && p.rem > 0 ? left / p.rem : null;
    tile('Ad spend: current vs budget left per day', '₹' + N2(curSpend / 1e5) + ' / ₹' + N2(reqSpend / 1e5) + ' L', 'Meta + Google; ₹' + N2(left / 1e5) + ' L of ₹' + N2(budget / 1e5) + ' L left', curSpend && reqSpend ? (curSpend <= reqSpend * 1.05 ? 'ok' : 'warn') : '');
    tile('MER now vs MER needed', (mer ? mer.toFixed(1) : '—') + '× / ' + (merNeed ? merNeed.toFixed(1) : '—') + '×', 'Website sales ÷ ad spend; needed = website still to reach ₹6 Cr ÷ budget left', mer && merNeed ? (mer >= merNeed ? 'ok' : mer >= merNeed * 0.8 ? 'warn' : 'bad') : '');
  });
})();
