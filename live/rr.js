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
  });
  // Ad spend vs the phased BFS plan, from the sale start (27 Nov) to the end of the plan (7 Dec morning), day by day and in total.
  const SP0 = '2026-11-27';
  const spCalc = () => {
    const p = pace(); const daily = ok('spend_daily'), ads = ok('ads') || [];
    if (!p || !daily) return null;
    const today = p.c.today, frac = p.todayFrac;
    const meta = ads.find((r) => r.platform === 'Meta') || {}, g = ads.find((r) => r.platform === 'Google') || {};
    const rows = daily.filter((r) => r.date >= SP0).sort((x, y) => (x.date < y.date ? -1 : 1)).map((r) => {
      const isT = r.date === today, fut = r.date > today;
      const ma = fut ? null : isT ? Math.max(+meta.spend_today || 0, +r.meta_actual || 0) : (r.meta_actual == null ? null : +r.meta_actual);
      const ga = fut ? null : isT ? Math.max(+g.spend_today || 0, +r.google_actual || 0) : (r.google_actual == null ? null : +r.google_actual);
      const mp = +r.meta_plan || 0, gp = +r.google_plan || 0, tp = mp + gp, ta = ma == null && ga == null ? null : (ma || 0) + (ga || 0);
      const planNow = fut ? 0 : isT ? tp * frac : tp;
      const web = fut ? null : (r.web_actual == null ? null : +r.web_actual);
      return {date: r.date, day: r.day, phase: r.phase, mp, ma, gp, ga, tp, ta, planNow, isT, fut, web, webT: +r.revenue_target || null, merPlan: +r.total_roas_target || null, mer: web != null && ta ? web * 1e5 / ta : null};
    });
    const sum = (k, f) => rows.filter(f || (() => true)).reduce((a, r) => a + (+r[k] || 0), 0);
    const budget = sum('tp'), spent = sum('ta'), planNow = sum('planNow'), metaBudget = sum('mp'), gBudget = sum('gp');
    const daysLeftPlan = rows.filter((r) => r.date > today);
    const left = budget - spent, planLeft = sum('tp', (r) => r.date > today) + (rows.find((r) => r.isT) ? Math.max(0, rows.find((r) => r.isT).tp - (rows.find((r) => r.isT).ta || 0)) : 0);
    const webSale = sum('web', (r) => !r.fut), webPlanNow = rows.filter((r) => !r.fut).reduce((a, r) => a + (r.webT || 0) * (r.isT ? frac : 1), 0);
    const tr = rows.find((r) => r.isT) || {};
    return {rows, budget, spent, planNow, metaBudget, gBudget, left, planLeft, rem: p.rem, nLeft: daysLeftPlan.length, webSale, webPlanNow, mer: spent ? webSale * 1e5 / spent : null, merPlanNow: planNow ? webPlanNow * 1e5 / planNow : null, merNeed: left > 0 ? Math.max(0, 600 - webSale) * 1e5 / left : null, today: tr, frac};
  };
  window.rrSpend = spCalc;
  const L = (v) => v == null || !isFinite(v) ? '—' : N2(v / 1e5);
  dash.draw('sp27-tiles', (el) => {
    const s = spCalc(); el.replaceChildren(); if (!s) return;
    const tile = (k, v, sub, c2) => { const d = document.createElement('div'); d.className = 'lv-tile'; const a = document.createElement('span'); a.className = 'k'; a.textContent = k; const b = document.createElement('span'); b.className = 'v' + (c2 ? ' ' + c2 : ''); b.textContent = v; const e = document.createElement('span'); e.className = 's'; e.textContent = sub; d.append(a, b, e); el.appendChild(d); };
    const over = (a, b) => a == null || !b ? '' : a <= b * 1.05 ? 'ok' : a <= b * 1.2 ? 'warn' : 'bad';
    tile('Ad spend today vs day plan', '₹' + L(s.today.ta) + ' / ₹' + L(s.today.tp) + ' L', 'Meta ₹' + L(s.today.ma) + ' L of ₹' + L(s.today.mp) + ' L · Google ₹' + L(s.today.ga) + ' L of ₹' + L(s.today.gp) + ' L · expected by now ₹' + L(s.today.planNow) + ' L', over(s.today.ta, s.today.planNow));
    tile('Ad spend from 27 Nov vs plan to date', '₹' + L(s.spent) + ' / ₹' + L(s.planNow) + ' L', (s.planNow ? PC(s.spent / s.planNow) + ' of plan to date · ' : '') + PC(s.spent / s.budget) + ' of the ₹' + L(s.budget) + ' L sale budget used', over(s.spent, s.planNow));
    tile('Budget left: per day vs plan per day', '₹' + L(s.rem > 0 ? s.left / s.rem : null) + ' / ₹' + L(s.rem > 0 ? s.planLeft / s.rem : null) + ' L', '₹' + L(s.left) + ' L left of ₹' + L(s.budget) + ' L (Meta ₹' + L(s.metaBudget) + ' L + Google ₹' + L(s.gBudget) + ' L, 27 Nov – 7 Dec plan)', s.left < s.planLeft * 0.95 ? 'warn' : 'ok');
    tile('MER from 27 Nov: actual vs plan vs needed', (s.mer ? s.mer.toFixed(1) : '—') + '× / ' + (s.merPlanNow ? s.merPlanNow.toFixed(1) : '—') + '× / ' + (s.merNeed ? s.merNeed.toFixed(1) : '—') + '×', 'Website ₹' + N2(s.webSale) + ' L on ₹' + L(s.spent) + ' L spend; needed = website still to reach ₹6 Cr ÷ budget left', s.mer && s.merNeed ? (s.mer >= s.merNeed ? 'ok' : s.mer >= s.merNeed * 0.8 ? 'warn' : 'bad') : '');
  });
  dash.draw('sp27-body', (tb) => {
    const s = spCalc(); tb.replaceChildren(); if (!s) return;
    const fmtD = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
    const line = (cells, cl) => { const tr = tb.insertRow(); if (cl) tr.className = cl; cells.forEach(([t, k]) => { const td = tr.insertCell(); td.textContent = t; if (k) td.classList.add(...String(k).split(' ').filter(Boolean)); }); };
    let runP = 0, runA = 0;
    s.rows.forEach((r) => {
      runP += r.tp; if (r.ta != null) runA += r.ta; const pct = r.ta != null && r.tp ? r.ta / (r.isT ? r.planNow || r.tp : r.tp) : null;
      line([[r.day, 'l'], [fmtD(r.date) + (r.isT ? ' (so far)' : ''), 'l'], [r.phase || '', 'l'], [L(r.mp)], [r.fut ? '' : L(r.ma)], [L(r.gp)], [r.fut ? '' : L(r.ga)], [L(r.tp)], [r.fut ? '' : L(r.ta)], [r.fut ? '' : PC(pct), r.fut || pct == null ? '' : pct <= 1.05 ? 'ok' : pct <= 1.2 ? 'warn' : 'bad'], [r.webT == null ? '—' : N2(r.webT)], [r.web == null ? '' : N2(r.web)], [r.merPlan ? r.merPlan.toFixed(1) + '×' : '—'], [r.mer ? r.mer.toFixed(1) + '×' : '', r.mer && r.merPlan ? (r.mer >= r.merPlan ? 'ok' : r.mer >= r.merPlan * 0.7 ? 'warn' : 'bad') : ''], [L(runP)], [r.fut ? '' : L(runA)]], r.isT ? 'now' : r.fut ? 'fut' : '');
    });
    line([['Sale to date', 'l'], ['27 Nov → now', 'l'], ['', 'l'], [''], [''], [''], [''], [L(s.planNow)], [L(s.spent)], [PC(s.planNow ? s.spent / s.planNow : null)], [N2(s.webPlanNow)], [N2(s.webSale)], [s.merPlanNow ? s.merPlanNow.toFixed(1) + '×' : '—'], [s.mer ? s.mer.toFixed(1) + '×' : '—'], [''], ['']], 'tot');
    line([['Full sale plan', 'l'], ['27 Nov – 7 Dec', 'l'], ['', 'l'], [L(s.metaBudget)], [''], [L(s.gBudget)], [''], [L(s.budget)], [''], [''], [N2(s.rows.reduce((a, r) => a + (r.webT || 0), 0))], [''], [''], [''], [''], ['']], 'tot');
  });
  dash.draw('sp27-note', (el) => { const s = spCalc(); el.textContent = !s ? '—' : '₹ lakh. Plan = the BFS media plan by day (Meta + Google) from the sale start on 27 Nov to the close on 7 Dec morning; pre-sale spend (18–26 Nov) is not counted here. Today\'s "expected by now" = today\'s plan × ' + Math.round(s.frac * 100) + '% (share of last year\'s same sale day done by this hour). Website sales and target are Shopify net excl. GST; MER = website sales ÷ Meta + Google spend; plan MER = the plan\'s day target on all ad spend. The sales targets in the run-rate table above are Zuber\'s ₹7 Cr plan; the website target here is the agency\'s ₹6 Cr media plan.'; });
})();
