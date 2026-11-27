// Spends tracker and "What to run next" (own scope: helpers copied from the page)
const spG = {L2: d3.format(',.2f'), N: d3.format(',.0f'), P: d3.format('.0%'), X: d3.format('.1f')};
const spTime = (s) => { const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}); };
function spTable(tb, id, cols, opts) {
  const d = dash.data(id);
  tb.replaceChildren();
  if (d.status !== 'ok' || !d.data) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = cols.length; td.className = 'l'; td.textContent = d.status === 'error' ? 'Could not load this table.' : '—'; return; }
  let rows = d.data.slice(); if (opts && opts.sort) rows.sort(opts.sort); if (opts && opts.fk) rows = window.lvFilt(opts.fk, rows);
  rows.forEach((r) => { const tr = tb.insertRow(); if (opts && opts.key) tr.dataset.key = r[opts.key];
    cols.forEach((c) => { const td = tr.insertCell(); if (c.l) td.className = 'l'; if (c.w) td.classList.add('w');
      const v = c.f ? r[c.f] : null; const txt = c.calc ? c.calc(r) : (c.fmt ? (v == null || v === '' ? '—' : c.fmt(+v)) : (v == null ? '' : String(v)));
      if (c.pill) { const s = document.createElement('span'); s.className = 'lv-pill ' + c.pill(r, txt); s.textContent = txt; td.appendChild(s); } else td.textContent = txt;
      if (c.cls) { const k = c.cls(r); if (k) td.classList.add(k); } }); });
}
function spTip(el) { let t = el.querySelector('.lv-tip'); if (!t) { t = document.createElement('div'); t.className = 'lv-tip'; t.hidden = true; el.appendChild(t); } return t; }
// Table filters and sorting (Marketing tab): values live in dash.params, the tables' drawings apply them
window.lvF2 = {liq: {id: 'liquidation', f: ['style', 'name', 'category', 'action', 'web']}, out: {id: 'ads_out', f: ['style', 'name', 'reason']}, next: {id: 'next_ads', f: ['category', 'play', 'styles']}, moves: {id: 'ad_moves', f: ['campaign', 'focus', 'move']}, parity: {id: 'bundle_check', f: ['listings', 'issue', 'fix']}, camp: {id: 'campaigns', f: ['campaign', 'platform', 'focus']}};
window.lvFilt = (k, rows) => {
  const c = window.lvF2[k]; if (!c || !Array.isArray(rows)) return rows;
  const P = dash.params() || {};
  const q = String(P['q_' + k] || '').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
  const r = q.length ? rows.filter((row) => { const t = c.f.map((f) => (row[f] == null ? '' : String(row[f]))).join(' ').toLowerCase(); return q.some((x) => t.includes(x)); }) : rows.slice();
  const s = P['s_' + k];
  if (s) { const [f, d] = String(s).split(':'); const m = d === 'asc' ? 1 : -1; r.sort((a, b) => { const x = parseFloat(a[f]), y = parseFloat(b[f]); if (isNaN(x) && isNaN(y)) return 0; if (isNaN(x)) return 1; if (isNaN(y)) return -1; return (x - y) * m; }); }
  return r;
};
Object.keys(window.lvF2).forEach((k) => dash.draw('cnt-' + k, (el) => { const d = dash.data(window.lvF2[k].id); if (d.status !== 'ok' || !Array.isArray(d.data)) { el.textContent = ''; return; } const n = window.lvFilt(k, d.data).length; el.textContent = n === d.data.length ? d.data.length + ' rows' : 'Showing ' + n + ' of ' + d.data.length; }));
document.querySelectorAll('.lv-tools [data-p]').forEach((el) => {
  const p = el.dataset.p; let t;
  const v = (dash.params() || {})[p]; if (v != null && v !== '') el.value = v;
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { clearTimeout(t); t = setTimeout(() => dash.setParams({[p]: el.value || null}), el.tagName === 'SELECT' ? 0 : 250); });
});
dash.calc('spend_tot', {inputs: ['spend_daily', 'spend_intraday', 'ads'], title: 'Meta spend tracker totals', description: 'Today: latest Meta spend reading vs the day plan, with expected-by-now = day plan x share of the day gone (IST). BFS to date = Meta spend from 18 Nov incl. today. Budget left = 70 L minus BFS to date.', fn: (daily, intra, ads) => {
  const last = intra.length ? intra.reduce((a, b) => (a.as_of > b.as_of ? a : b)) : null;
  const meta = ads.find((r) => r.platform === 'Meta') || {};
  const asOf = last ? last.as_of : meta.as_of;
  const day = asOf ? String(asOf).slice(0, 10) : null;
  const t = daily.find((r) => r.date === day) || {};
  const todayActual = Math.max(+(last && last.meta_spend) || 0, +meta.spend_today || 0, +t.meta_actual || 0);
  const d = new Date(asOf); const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
  const frac = Math.max(0.02, (ist.getHours() * 60 + ist.getMinutes()) / 1440);
  const plan = +t.meta_plan || 0;
  const prior = d3.sum(daily.filter((r) => r.date < day), (r) => +r.meta_actual || 0);
  const priorPlan = d3.sum(daily.filter((r) => r.date < day), (r) => +r.meta_plan || 0);
  const after = daily.filter((r) => r.date > day && +r.meta_plan > 0);
  const L = (v) => Math.round(v / 1e3) / 100;
  return [{as_of: asOf, today_actual: L(todayActual), today_plan: L(plan), expected_now: L(plan * frac), pace: plan ? todayActual / (plan * frac) : null, projected_today: L(todayActual / frac), bfs_actual: L(prior + todayActual), bfs_plan: L(priorPlan + plan), bfs_variance: L(prior + todayActual - priorPlan - plan), budget_left: L(7000000 - prior - todayActual), remaining_plan: L(d3.sum(after, (r) => +r.meta_plan)), days_left: after.length}];
}});
dash.calc('cat_pace', {inputs: ['campaigns', 'cat_plan', 'spend_tot'], title: 'Meta spend by category vs plan', description: "Today's Meta campaign spend grouped by the category in the campaign name (broad, catalogue and retargeting = sale-wide; tops & dresses split half and half) against the media plan category share of today's day plan.", fn: (campaigns, plan, tot) => {
  const keyOf = {Kurta: 'Kurta', Dress: 'Dress', 'Short tops & shirts': 'Short tops & shirts', 'Co-ord set': 'Co-ord set', 'Broad / mix': 'Sale-wide', Catalog: 'Sale-wide', Retargeting: 'Sale-wide', Stores: 'Stores', 'Suit set': 'Suit set'};
  const acc = {};
  campaigns.filter((r) => r.platform === 'Meta').forEach((r) => {
    const parts = /bestperform|bestseller/i.test(r.campaign) ? [['Bestseller', 1]] : r.focus === 'Tops & dresses' ? [['Dress', 0.5], ['Short tops & shirts', 0.5]] : [[keyOf[r.focus] || 'Unassigned', 1]];
    parts.forEach(([k, w]) => { const a = acc[k] || (acc[k] = {s: 0, v: 0}); a.s += (+r.spend || 0) * w; a.v += (+r.revenue || 0) * w; });
  });
  const dayPlan = tot && tot[0] ? tot[0].today_plan * 1e5 : 0;
  const rows = plan.map((p) => { const a = acc[p.key] || {s: 0, v: 0}; return {category: p.category, plan_share: +p.share, plan_today: Math.round(dayPlan * p.share), spend_today: Math.round(a.s), gap: Math.round(a.s - dayPlan * p.share), roas: a.s ? a.v / a.s : null}; });
  ['Stores', 'Unassigned'].forEach((k) => { if (acc[k]) rows.push({category: k === 'Stores' ? 'Store campaigns (not in plan)' : 'Unassigned', plan_share: 0, plan_today: 0, spend_today: Math.round(acc[k].s), gap: Math.round(acc[k].s), roas: acc[k].s ? acc[k].v / acc[k].s : null}); });
  return rows;
}});
dash.calc('ad_moves', {inputs: ['campaigns', 'ads', 'spend_daily', 'sales'], title: 'Budget moves on live Meta campaigns', description: "Meta campaigns with 2K+ spend today, judged on Ads Manager ROAS against the BFS plan for the day: target = the day's website ROAS target and minimum = the phase minimum (7 peak, 6 sustain, 5 closing, on Shopify revenue), both converted to Ads Manager terms with today's live ratio of Meta revenue in Ads Manager to Shopify net sales. 15%+ above target: scale +30% (plan: release reserve). Between minimum and target: hold. Below minimum with 10K+ spent: cut 20% (plan rule), pause if under half the minimum. Today's spend stands in for the daily budget.", fn: (campaigns, ads, daily, sales) => {
  const m = ads.find((r) => r.platform === 'Meta') || {}; const p = spPlanDay(daily, m.as_of);
  const k = spK(ads, sales); const tg = p.web_meta_target ? +p.web_meta_target * k : (+p.meta_am_target || 5), mn = p.roas_floor ? +p.roas_floor * k : tg * 0.5;
  return campaigns.filter((r) => r.platform === 'Meta' && r.id !== 'M|Other' && (+r.spend || 0) >= 2000 && r.status !== 'Preparing').map((r) => {
    const s = +r.spend, x = +r.roas || 0; let move = 'Hold: on plan', ch = 0;
    if (x >= tg * 1.15) { move = 'Scale +30%'; ch = Math.round(s * 0.3); }
    else if (x >= tg) move = 'Hold: on plan';
    else if (x >= mn) move = 'Hold: above minimum';
    else if (s >= 10000) { if (x < mn * 0.5) { move = 'Pause'; ch = -Math.round(s); } else { move = 'Cut 20%'; ch = -Math.round(s * 0.2); } }
    else move = 'Watch (low spend)';
    return {id: r.id, campaign: r.campaign, focus: r.focus, spend: s, roas: x, move, change: ch, floor: Math.round(mn * 10) / 10, target: Math.round(tg * 10) / 10};
  });
}});
dash.calc('moves_tot', {inputs: ['ad_moves'], title: 'Budget moves totals', description: 'Budget freed by pausing or cutting, budget added to scaling campaigns, and what is left for new product ad sets (per day).', fn: (moves) => {
  const rel = -d3.sum(moves.filter((r) => r.change < 0), (r) => r.change), add = d3.sum(moves.filter((r) => r.change > 0), (r) => r.change);
  return [{released: rel, added: add, for_new: Math.max(0, rel - add), cut_count: moves.filter((r) => r.change < 0).length, scale_count: moves.filter((r) => r.change > 0).length}];
}});
dash.calc('next_ads', {inputs: ['liquidation', 'moves_tot', 'cat_plan'], title: 'Next ad sets by priority', description: 'Liquidation styles grouped into ad plays by category. Priority 1 = selling with stock for all of BFS (scale), 2 = live but slow deep stock and styles published today (new ad sets), 3 = stock that outlasts BFS (catalogue / retargeting), 4 = not on the website yet (get live first, no budget). Suggested budget splits the budget left for new ad sets by stock left on 6 Dec, with priority 1 weighted 1.5x.', fn: (rows, mt, plan) => {
  const what = {Kurta: 'Category hero ads by collection, catalogue sets, price-point ads (under ₹1,499 / ₹1,999)', Dress: 'Dress catalogue and reels; party and winter-wedding styling', 'Short tops & shirts': 'Catalogue ads; pair with bottoms bundle', 'Co-ord set': 'DyeVerse and printed co-ord reels', 'Suit set': 'Set-focused reels and carousels (high AOV)', Bottom: 'Bundle creatives only (complete the look, 2 for ₹2,199); retargeting', Dupatta: 'Bundle creatives only (complete the look); retargeting', Slip: 'Add-on in bundles; retargeting', Saree: 'Catalogue + retargeting'};
  const plays = [[1, 'Scale: proven sellers, stock lasts', (r) => /^Scale/.test(r.action), (r) => -r.per_day], [2, 'New ad sets: deep stock, live but slow', (r) => /^Liquidate|^New today/.test(r.action), (r) => -r.atp], [3, 'Catalogue / retargeting push', (r) => /^Push/.test(r.action), (r) => -r.left_after_bfs], [4, 'Get live first (no ads yet)', (r) => /^Get it live/.test(r.action), (r) => -r.atp]];
  const out = [];
  plays.forEach(([p, play, f, sortKey]) => {
    d3.groups(rows.filter(f), (r) => r.category).forEach(([cat, rs]) => {
      rs.sort((a, b) => sortKey(a) - sortKey(b));
      const stock = d3.sum(rs, (r) => +r.atp), left = d3.sum(rs, (r) => +r.left_after_bfs || 0);
      const nm = (r) => String(r.name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).join(' ');
      out.push({id: p + '|' + cat, priority: p, play, category: cat, styles: rs.slice(0, 5).map((r) => r.style + ' ' + nm(r) + ' (' + r.atp + ')').join('; ') + (rs.length > 5 ? '; +' + (rs.length - 5) + ' more' : ''), stock, n: rs.length, w: p === 4 ? 0 : (p === 1 ? 1.5 : 1) * Math.max(left, stock * 0.3), what_to_run: p === 4 ? 'List or publish on Shopify first; then add to the matching category ads' : (what[cat] || 'Catalogue + retargeting')});
    });
  });
  const pool = mt && mt[0] ? mt[0].for_new : 0, W = d3.sum(out, (r) => r.w);
  out.forEach((r) => { r.budget = W && r.w ? Math.round(pool * r.w / W / 100) * 100 : 0; delete r.w; });
  return out.sort((a, b) => a.priority - b.priority || b.stock - a.stock);
}});
dash.calc('ads_out', {inputs: ['liquidation'], title: 'Styles to take out of ads', description: 'Sold out, only virtual stock left, or will sell out before 6 Dec without help.', fn: (rows) => rows.filter((r) => /^Stop|^Virtual|^Will sell/.test(r.action)).map((r) => ({style: r.style, name: r.name, reason: /^Stop/.test(r.action) ? 'Sold out: pause and swap creatives' : /^Virtual/.test(r.action) ? 'Only virtual stock: pause unless it can ship' : 'Will sell out by itself: no paid push', sold_today: +r.sold_today, atp: +r.atp})).sort((a, b) => b.sold_today - a.sold_today)});
const spV = (field, fmt) => (el) => { const d = dash.data('spend_tot'); const r = d.status === 'ok' && d.data ? d.data[0] : null; const v = r ? r[field] : null; el.textContent = v == null || v === '' ? '—' : fmt(v); };
const mvV = (field, fmt) => (el) => { const d = dash.data('moves_tot'); const r = d.status === 'ok' && d.data ? d.data[0] : null; const v = r ? r[field] : null; el.textContent = v == null || v === '' ? '—' : fmt(+v); };
dash.draw('sp-asof', spV('as_of', (v) => spTime(v)));
dash.draw('sp-today', spV('today_actual', spG.L2));
dash.draw('sp-tplan', spV('today_plan', spG.L2));
dash.draw('sp-pace', spV('pace', spG.P));
dash.draw('sp-proj', spV('projected_today', spG.L2));
dash.draw('sp-exp', spV('expected_now', spG.L2));
dash.draw('sp-bfs', spV('bfs_actual', spG.L2));
dash.draw('sp-bfsp', spV('bfs_plan', spG.L2));
dash.draw('sp-bfsv', spV('bfs_variance', (v) => (v > 0 ? '+' : '') + spG.L2(v)));
dash.draw('sp-left', spV('budget_left', spG.L2));
dash.draw('sp-days', spV('days_left', spG.N));
dash.draw('sp-rplan', spV('remaining_plan', spG.L2));
dash.draw('b-spendday', (tb) => spTable(tb, 'spend_daily', [{f: 'date', l: 1, calc: (r) => new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}, {f: 'day', l: 1}, {f: 'phase', l: 1}, {f: 'meta_plan', fmt: spG.N}, {f: 'meta_actual', fmt: spG.N}, {calc: (r) => r.meta_actual == null || !r.meta_plan ? '—' : spG.P(r.meta_actual / r.meta_plan), cls: (r) => r.meta_actual == null || r.status === 'today' ? '' : r.meta_actual > r.meta_plan * 1.1 ? 'warn' : ''}, {f: 'meta_value', fmt: spG.N}, {f: 'roas_floor', fmt: spG.X}, {f: 'google_plan', fmt: spG.N}, {f: 'google_actual', fmt: spG.N}], {sort: (a, b) => (a.date < b.date ? -1 : 1), key: 'date'}));
dash.draw('b-catpace', (tb) => spTable(tb, 'cat_pace', [{f: 'category', l: 1}, {f: 'plan_share', fmt: spG.P}, {f: 'plan_today', fmt: spG.N}, {f: 'spend_today', fmt: spG.N}, {f: 'gap', fmt: (v) => (v > 0 ? '+' : '') + spG.N(v), cls: (r) => r.plan_share && r.gap < -0.3 * r.plan_today ? 'warn' : ''}, {f: 'roas', fmt: spG.X, cls: spRc}, {calc: () => spTg()}]));
dash.draw('nx-rel', mvV('released', (v) => '₹' + spG.N(v)));
dash.draw('nx-reln', mvV('cut_count', spG.N));
dash.draw('nx-add', mvV('added', (v) => '₹' + spG.N(v)));
dash.draw('nx-addn', mvV('scale_count', spG.N));
dash.draw('nx-new', mvV('for_new', (v) => '₹' + spG.N(v)));
dash.draw('b-moves', (tb) => spTable(tb, 'ad_moves', [{f: 'campaign', l: 1, w: 1}, {f: 'focus', l: 1}, {f: 'spend', fmt: spG.N}, {f: 'roas', fmt: spG.X, cls: (r) => r.roas >= r.target ? 'ok' : r.roas >= r.floor ? 'warn' : 'bad'}, {f: 'target', fmt: spG.X}, {f: 'floor', fmt: spG.X}, {f: 'move', l: 1, pill: (r) => /^Scale/.test(r.move) ? 'ok' : /^Pause|^Cut/.test(r.move) ? 'bad' : /^Watch/.test(r.move) ? 'warn' : ''}, {f: 'change', fmt: (v) => (v > 0 ? '+' : '') + spG.N(v)}], {sort: (a, b) => Math.abs(b.change) - Math.abs(a.change) || b.spend - a.spend, key: 'id', fk: 'moves'}));
dash.draw('b-nextads', (tb) => spTable(tb, 'next_ads', [{f: 'priority', fmt: spG.N}, {f: 'play', l: 1, pill: (r) => r.priority === 1 ? 'ok' : r.priority === 4 ? 'warn' : ''}, {f: 'category', l: 1}, {f: 'styles', l: 1, w: 1}, {f: 'stock', fmt: spG.N}, {f: 'budget', fmt: (v) => v ? spG.N(v) : '—'}, {f: 'what_to_run', l: 1, w: 1}], {key: 'id', fk: 'next'}));
dash.draw('b-adsout', (tb) => spTable(tb, 'ads_out', [{f: 'style', l: 1}, {f: 'name', l: 1, w: 1}, {f: 'reason', l: 1, pill: (r) => /Sold out/.test(r.reason) ? 'bad' : 'warn'}, {f: 'sold_today', fmt: spG.N}, {f: 'atp', fmt: spG.N}], {key: 'style', fk: 'out'}));
dash.draw('c-spend-daily', (el) => {
  const d = dash.data('spend_daily'); el.replaceChildren();
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Could not load.' : '—'; return; }
  const rows = d.data.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => ({k: new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short'}), plan: (+r.meta_plan || 0) / 1e5, act: r.meta_actual == null ? null : (+r.meta_actual) / 1e5, today: r.status === 'today'}));
  const W = el.clientWidth || 360, H = 262, m = {t: 12, r: 8, b: 62, l: 36};
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Meta spend per day, plan vs actual, ₹ lakh');
  const x = d3.scaleBand(rows.map((r) => r.k), [m.l, W - m.r]).padding(0.2);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.plan, r.act || 0)) * 1.1 || 1], [H - m.b, m.t]).nice();
  const x2 = d3.scaleBand(['plan', 'act'], [0, x.bandwidth()]).padding(0.1);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(rows.filter((r, i) => i % Math.max(1, Math.ceil(rows.length / Math.max(4, Math.floor(W / 48)))) === 0).map((r) => r.k))).selectAll('text').attr('transform', 'rotate(-35)').style('text-anchor', 'end');
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4)).call((g) => g.select('.domain').remove());
  const tip = spTip(el);
  const bars = svg.append('g');
  bars.selectAll('rect.p').data(rows).join('rect').attr('class', 'p').attr('x', (r) => x(r.k) + x2('plan')).attr('y', (r) => y(r.plan)).attr('width', x2.bandwidth()).attr('height', (r) => y(0) - y(r.plan)).attr('rx', 1).style('fill', dash.colors[0]).style('opacity', 0.45);
  bars.selectAll('rect.a').data(rows.filter((r) => r.act != null)).join('rect').attr('class', 'a').attr('x', (r) => x(r.k) + x2('act')).attr('y', (r) => y(r.act)).attr('width', x2.bandwidth()).attr('height', (r) => y(0) - y(r.act)).attr('rx', 1).style('fill', (r) => r.act > r.plan * 1.1 ? dash.colors[1] : dash.colors[0]);
  svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.k)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent')
    .on('pointerenter', (e, r) => { tip.hidden = false; tip.textContent = r.k + ': plan ₹' + spG.L2(r.plan) + ' L' + (r.act != null ? ', actual ₹' + spG.L2(r.act) + ' L' + (r.today ? ' so far' : '') : ''); tip.style.left = Math.min(x(r.k), W - 220) + 'px'; tip.style.top = '0px'; }).on('pointerleave', () => { tip.hidden = true; });
  const lg = svg.append('g').attr('transform', `translate(${m.l},${H - 6})`);
  [['Plan', dash.colors[0], 0.45], ['Actual', dash.colors[0], 1], ['Actual >10% over plan', dash.colors[1], 1]].forEach(([t, c, o], i) => { lg.append('rect').attr('x', i * 90).attr('y', -9).attr('width', 10).attr('height', 10).style('fill', c).style('opacity', o); lg.append('text').attr('x', i * 90 + 14).attr('y', 0).text(t); });
});
dash.draw('c-spend-intra', (el) => {
  const d = dash.data('spend_intraday'), t = dash.data('spend_tot'); el.replaceChildren();
  if (d.status !== 'ok' || t.status !== 'ok' || !t.data || !t.data[0]) { el.textContent = d.status === 'error' ? 'Could not load.' : '—'; return; }
  const plan = t.data[0].today_plan; const day = String(t.data[0].as_of).slice(0, 10);
  const pts = d.data.filter((r) => String(r.as_of).slice(0, 10) === day).map((r) => { const s = String(r.as_of); const h = +s.slice(11, 13) + (+s.slice(14, 16)) / 60; return {h, v: (+r.meta_spend) / 1e5}; }).sort((a, b) => a.h - b.h);
  const W = el.clientWidth || 360, H = 220, m = {t: 12, r: 12, b: 26, l: 36};
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', "Today's Meta spend by time of day against an even pace to the day plan, ₹ lakh");
  const x = d3.scaleLinear([0, 24], [m.l, W - m.r]);
  const y = d3.scaleLinear([0, Math.max(plan, d3.max(pts, (p) => p.v) || 0) * 1.1 || 1], [H - m.b, m.t]).nice();
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues([0, 6, 12, 18, 24]).tickFormat((h) => (h % 24) + ':00'));
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4)).call((g) => g.select('.domain').remove());
  svg.append('line').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(24)).attr('y2', y(plan)).style('stroke', dash.colors[0]).style('opacity', 0.5).attr('stroke-dasharray', '4 3');
  svg.append('text').attr('x', x(24) - 4).attr('y', y(plan) - 6).attr('text-anchor', 'end').text('Day plan ₹' + spG.L2(plan) + ' L');
  const line = [{h: 0, v: 0}].concat(pts);
  svg.append('path').datum(line).attr('fill', 'none').style('stroke', dash.colors[1]).attr('stroke-width', 2).attr('d', d3.line().x((p) => x(p.h)).y((p) => y(p.v)));
  const tip = spTip(el);
  svg.selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.h)).attr('cy', (p) => y(p.v)).attr('r', 4).style('fill', dash.colors[1])
    .on('pointerenter', (e, p) => { tip.hidden = false; tip.textContent = Math.floor(p.h) + ':' + String(Math.round((p.h % 1) * 60)).padStart(2, '0') + ' — ₹' + spG.L2(p.v) + ' L spent'; tip.style.left = Math.min(x(p.h), W - 170) + 'px'; tip.style.top = Math.max(0, y(p.v) - 34) + 'px'; }).on('pointerleave', () => { tip.hidden = true; });
});
const SP_AM = 1.172 * 0.5; // plan: Ads Manager value = website net x GST 1.172 x Meta share 50%
function spK(ads, sales) { const m = (ads || []).find((r) => r.platform === 'Meta') || {}; const w = ((sales || []).find((r) => r.channel === 'Shopify') || {}).net_lakh; const k = +w > 5 && +m.revenue_today > 0 ? +m.revenue_today / (+w * 1e5) : null; return k && k > 0.2 && k < 2 ? k : SP_AM; }
function spPlanDay(daily, asOf) { const day = asOf ? String(asOf).slice(0, 10) : null; return daily.find((r) => r.date === day) || {}; }
dash.calc('roas_now', {inputs: ['ads', 'spend_daily', 'sales'], title: 'ROAS today vs the BFS plan', description: "From the BFS 2026 Meta Ads Plan (Daywise Plan): Meta ROAS in Ads Manager vs the day's website ROAS target and phase minimum converted to Ads Manager terms with today's live ratio of Meta revenue in Ads Manager to Shopify net sales (the plan's assumed 0.586 = 1.172 GST x 50% Meta share is used until Shopify net passes ₹5 L). Website ROAS = Shopify net sales excl. GST ÷ Meta spend (the basis of the plan's minimum: 7 peak, 6 sustain, 5 closing) and ÷ Meta + Google spend. Website revenue vs the day's revenue target. Google runs a fixed ₹50K a day with no ROAS target in the plan.", fn: (ads, daily, sales) => {
  const meta = ads.find((r) => r.platform === 'Meta') || {}, g = ads.find((r) => r.platform === 'Google') || {};
  const p = spPlanDay(daily, meta.as_of || g.as_of);
  const web = (sales.find((r) => r.channel === 'Shopify') || {}).net_lakh; const W = web == null ? null : +web * 1e5;
  const ms = +meta.spend_today || 0, gs = +g.spend_today || 0;
  const st = (x, t, mn) => x == null || !t ? '—' : x >= t * 1.15 ? 'Beating plan by 15%+: release reserve' : x >= t ? 'On plan' : mn != null && x >= mn ? 'Above minimum, below plan' : mn != null ? 'Below minimum: cut Meta 20%' : 'Below plan';
  const row = (k, label, x, t, mn, extra) => ({id: k, label, roas: x, target: t || null, minimum: mn || null, pct: x != null && t ? x / t : null, status: st(x, t, mn), ...extra});
  const k = spK(ads, sales); const amMin = p.roas_floor ? +p.roas_floor * k : null; const amTg = p.web_meta_target ? +p.web_meta_target * k : +p.meta_am_target;
  const out = [
    row('meta', 'Meta ROAS in Ads Manager', ms ? +meta.revenue_today / ms : null, amTg, amMin, {mtd: +meta.roas_mtd || null, breakeven: meta.breakeven_roas == null ? null : +meta.breakeven_roas, note: (k === SP_AM ? 'plan ratio ' : 'ratio ') + k.toFixed(2)}),
    row('webmeta', 'Website ROAS on Meta spend', W != null && ms ? W / ms : null, +p.web_meta_target, +p.roas_floor, {}),
    row('webtotal', 'Website ROAS on all ad spend', W != null && ms + gs ? W / (ms + gs) : null, +p.total_roas_target, null, {}),
    row('google', 'Google ROAS', gs ? +g.revenue_today / gs : null, null, null, {mtd: +g.roas_mtd || null, status: 'Fixed ₹50K a day, search and shopping'}),
    {id: 'rev', label: 'Website revenue today', roas: web == null ? null : +web, target: +p.revenue_target || null, minimum: null, pct: web != null && p.revenue_target ? +web / +p.revenue_target : null, status: p.ly_revenue ? 'LY same day ₹' + spG.L2(+p.ly_revenue) + ' L' : '', mtd: null},
  ];
  out.push({id: 'focus', label: 'Plan focus today', status: p.focus || ''}); return out;
}});
function spRoasRow(k) { const d = dash.data('roas_now'); return d.status === 'ok' && d.data ? d.data.find((r) => r.id === k) : null; }
function spTg() { const r = spRoasRow('meta'); return r && r.target ? spG.X(r.target) : '—'; }
function spRc(r) { const m = spRoasRow('meta'); return !m || !m.minimum || r.roas == null ? '' : r.roas >= (m.target || m.minimum) ? 'ok' : r.roas >= m.minimum ? 'warn' : 'bad'; }
['meta', 'webmeta', 'webtotal', 'google', 'rev'].forEach((k) => {
  const isRev = k === 'rev';
  dash.draw('rn-' + k, (el) => { const r = spRoasRow(k); el.classList.remove('ok', 'bad', 'warn'); if (!r || r.roas == null) { el.textContent = '—'; return; } el.textContent = isRev ? '₹' + spG.L2(r.roas) + ' L' : spG.X(r.roas) + '×'; if (r.target) el.classList.add(r.roas >= r.target ? 'ok' : r.minimum == null || r.roas >= r.minimum ? 'warn' : 'bad'); });
  dash.draw('rn-' + k + '-t', (el) => { const r = spRoasRow(k); el.textContent = !r || !r.target ? (k === 'google' ? 'no target (fixed ₹50K/day)' : '—') : 'plan ' + (isRev ? '₹' + spG.L2(r.target) + ' L' : spG.X(r.target) + '×') + (r.minimum ? ' · min ' + spG.X(r.minimum) + '×' : ''); });
  dash.draw('rn-' + k + '-s', (el) => { const r = spRoasRow(k); if (!r) { el.textContent = '—'; return; } el.textContent = [r.pct != null ? spG.P(r.pct) + ' of plan' : '', r.status, k === 'meta' ? spWebMeta() : '', spPer(k), r.note || '', r.breakeven ? 'break-even ' + spG.X(r.breakeven) + '×' : ''].filter(Boolean).join(' · '); });
});
dash.draw('rn-focus', (el) => { const r = spRoasRow('focus'); el.textContent = r && r.status ? r.status : '—'; });

// BFS-period totals (18 Nov to 7 Dec); from 8 Dec the same tiles fall back to month to date from the ads file
const SP_SALE = '2026-11-27', SP_END = '2026-12-07';
dash.calc('bfs_tot', {inputs: ['spend_daily', 'ads', 'sales'], title: 'BFS to date', description: "Ad spend from the pre-sale start (18 Nov) to now, per platform and in all, against the BFS budgets (Meta ₹70 L, Google ₹5.7 L). Platform ROAS for the sale days (from 27 Nov) = platform revenue ÷ spend over those days. BFS MER = website (Shopify) net sales on sale days ÷ all BFS ad spend, the basis of the plan's 7.9× target (₹6 Cr ÷ ₹75.7 L); MER needed = revenue still to reach the ₹6 Cr target ÷ budget left. Past days come from the day-wise table, today from the live pull. After 7 Dec the platform rows switch to month to date.", fn: (daily, ads, sales) => {
  const meta = ads.find((r) => r.platform === 'Meta') || {}, g = ads.find((r) => r.platform === 'Google') || {};
  const day = String(meta.as_of || g.as_of || '').slice(0, 10);
  if (day > SP_END) return [{platform: 'Meta', period: 'mtd', spend: +meta.spend_mtd || 0, roas: +meta.roas_mtd || null}, {platform: 'Google', period: 'mtd', spend: +g.spend_mtd || 0, roas: +g.roas_mtd || null}, {platform: 'All', period: 'mtd', spend: (+meta.spend_mtd || 0) + (+g.spend_mtd || 0)}];
  const web = +((sales.find((r) => r.channel === 'Shopify') || {}).net_lakh) || 0;
  const past = daily.filter((r) => r.date < day), sale = past.filter((r) => r.date >= SP_SALE), isSale = day >= SP_SALE;
  const tr = daily.find((r) => r.date === day) || {};
  const ms = Math.max(+meta.spend_today || 0, +tr.meta_actual || 0), gs = Math.max(+g.spend_today || 0, +tr.google_actual || 0), mr = +meta.revenue_today || 0, gr = +g.revenue_today || 0;
  const mB = d3.sum(past, (r) => +r.meta_actual || 0) + ms, gB = d3.sum(past, (r) => +r.google_actual || 0) + gs;
  const mS = d3.sum(sale, (r) => +r.meta_actual || 0) + (isSale ? ms : 0), mV = d3.sum(sale, (r) => +r.meta_value || 0) + (isSale ? mr : 0);
  const gS = d3.sum(sale, (r) => +r.google_actual || 0) + (isSale ? gs : 0), gV = d3.sum(sale, (r) => +r.google_value || 0) + (isSale ? gr : 0);
  const mOk = sale.every((r) => r.meta_value != null), gOk = sale.every((r) => r.google_value != null), wOk = sale.every((r) => r.web_actual != null);
  const webSale = d3.sum(sale, (r) => +r.web_actual || 0) + (isSale ? web : 0);
  const planSale = d3.sum(daily.filter((r) => r.date >= SP_SALE && r.date <= day), (r) => +r.revenue_target || 0);
  const spent = mB + gB, left = 7570000 - spent;
  return [
    {platform: 'Meta', period: 'bfs', spend: mB, budget: 7000000, roas: mOk && mS ? mV / mS : null},
    {platform: 'Google', period: 'bfs', spend: gB, budget: 570000, roas: gOk && gS ? gV / gS : null},
    {platform: 'All', period: 'bfs', spend: spent, budget: 7570000, web_sale: wOk ? webSale : null, plan_sale: planSale, mer: wOk && spent ? webSale * 1e5 / spent : null, mer_target: 7.93, mer_needed: wOk && left > 0 ? (600 - webSale) * 1e5 / left : null},
  ];
}});
window.spBfs = (platform, f) => { const d = dash.data('bfs_tot'); const r = d.status === 'ok' && Array.isArray(d.data) ? d.data.find((x) => x.platform === platform) : null; return r ? r[f] : null; };
function spPer(k) { const p = k === 'meta' ? 'Meta' : k === 'google' ? 'Google' : null; if (!p) return ''; const x = window.spBfs(p, 'roas'); return x ? (window.spBfs(p, 'period') === 'mtd' ? 'MTD ' : 'BFS sale ') + spG.X(x) + '×' : ''; }
function spWebMeta() { const r = spRoasRow('webmeta'); return r && r.roas != null ? 'website ' + spG.X(r.roas) + '×' + (r.minimum ? ' (min ' + spG.X(r.minimum) + '×)' : '') : ''; }
const spB = (f, fmt) => (el) => { const v = window.spBfs('All', f); el.textContent = v == null ? '—' : fmt(v); };
dash.draw('gl-mer', (el) => { const v = window.spBfs('All', 'mer'); el.classList.remove('ok', 'warn', 'bad'); if (v == null) { el.textContent = '—'; return; } el.textContent = spG.X(v) + '×'; const n = window.spBfs('All', 'mer_needed'); el.classList.add(n == null || n <= 7.93 ? 'ok' : n <= 12 ? 'warn' : 'bad'); });
dash.draw('gl-mer-t', spB('mer_target', (v) => spG.X(v) + '×'));
dash.draw('gl-mer-s', (el) => { const w = window.spBfs('All', 'web_sale'), p = window.spBfs('All', 'plan_sale'), n = window.spBfs('All', 'mer_needed'); el.textContent = w == null ? 'Website sales for past sale days not filled yet' : 'Website ₹' + spG.L2(w) + ' L of ₹' + spG.L2(p || 0) + ' L plan to date' + (n ? ' · needs ' + spG.X(n) + '× on the rest of the budget to reach ₹6 Cr' : ''); });
dash.draw('gl-spend', (el) => { const v = window.spBfs('All', 'spend'); el.textContent = v == null ? '—' : '₹' + spG.L2(v / 1e5) + ' L'; });
dash.draw('gl-spend-k', (el) => { el.textContent = window.spBfs('All', 'period') === 'mtd' ? 'Ad spend, month to date' : 'Ad spend, BFS to date (from 18 Nov)'; });
dash.draw('gl-spend-s', (el) => { const t = dash.data('spend_tot'); const r = t.status === 'ok' && t.data ? t.data[0] : null; const m = window.spBfs('Meta', 'spend'), g = window.spBfs('Google', 'spend'); if (m == null) { el.textContent = '—'; return; } el.textContent = 'Meta ₹' + spG.L2(m / 1e5) + ' L of ₹70 L · Google ₹' + spG.L2((g || 0) / 1e5) + ' L of ₹5.7 L' + (r && r.today_plan ? ' · Meta today ₹' + spG.L2(r.today_actual) + ' L of ₹' + spG.L2(r.today_plan) + ' L plan (' + spG.P(r.pace) + ' of pace)' : ''); });
dash.draw('gl-mv', (el) => { const d = dash.data('moves_tot'); const r = d.status === 'ok' && d.data ? d.data[0] : null; el.textContent = r ? '₹' + spG.L2(r.released / 1e5) + ' L / day' : '—'; });
dash.draw('gl-mv-s', (el) => { const d = dash.data('moves_tot'); const r = d.status === 'ok' && d.data ? d.data[0] : null; el.textContent = r ? r.cut_count + ' campaigns to cut or pause · ' + r.scale_count + ' to scale (+₹' + spG.L2(r.added / 1e5) + ' L) · ₹' + spG.L2(r.for_new / 1e5) + ' L for new product ad sets' : '—'; });
dash.draw('h-sp', (el) => { el.textContent = window.spBfs('All', 'period') === 'mtd' ? 'Spend MTD (₹ L)' : 'Spend, BFS to date (₹ L)'; });
dash.draw('h-ro', (el) => { el.textContent = window.spBfs('All', 'period') === 'mtd' ? 'ROAS MTD' : 'ROAS, BFS sale days'; });
