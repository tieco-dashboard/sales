// Management GP tab: today, and BFS till now (27 Nov → this refresh) with a day-by-day GP snapshot (Zuber, 28 Nov).
// Data: gp (today, per channel/store), gp_daily (final GP per channel/store for each finished day), summary (as_of).
// After BFS the same view shows month to date (gp_daily keeps getting one set of rows per finished day).
(function () {
  const N2 = (v) => v == null || !isFinite(v) ? '—' : v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const PC = (v) => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(1) + '%';
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : null; };
  const iso = (v) => v instanceof Date ? v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0') : String(v).slice(0, 10);
  const B0 = '2026-11-27', B1 = '2026-12-06';
  const norm = (c) => c === 'Nykaa Fashion' ? 'Nykaa' : c;
  const K = ['net_lakh', 'returns_lakh', 'cogs_lakh', 'fees_lakh', 'logistics_lakh', 'marketing_lakh', 'contribution_lakh'];
  const sumUp = (rows) => { const o = {}; K.forEach((k) => { o[k] = rows.reduce((a, r) => a + (+r[k] || 0), 0); }); const after = o.net_lakh - o.returns_lakh;
    o.after = after; o.pgp = after ? (after - o.cogs_lakh) / after : null; o.cm_pct = after ? o.contribution_lakh / after : null; o.mkt_pct = after ? o.marketing_lakh / after : null; o.costs = o.fees_lakh + o.logistics_lakh; return o; };
  window.gpCalc = () => {
    const G = ok('gp'), sm = ok('summary'); if (!G || !sm || !sm[0]) return null;
    const asOf = String(sm[0].as_of || ''), today = asOf.slice(0, 10);
    const bfs = today >= B0 && today <= B1, start = bfs ? B0 : today.slice(0, 7) + '-01';
    const D = (ok('gp_daily') || []).map((r) => Object.assign({}, r, {date: iso(r.date), channel: norm(r.channel)})).filter((r) => r.date >= start && r.date < today);
    const T = G.map((r) => Object.assign({}, r, {date: today, channel: norm(r.channel)}));
    const per = {}; D.concat(T).forEach((r) => { (per[r.channel] = per[r.channel] || {channel: r.channel, type: r.type, rows: []}).rows.push(r); });
    const chPer = Object.values(per).map((x) => Object.assign({channel: x.channel, type: x.type}, sumUp(x.rows)));
    const chToday = T.map((r) => Object.assign({channel: r.channel, type: r.type}, sumUp([r])));
    const dates = [...new Set(D.map((r) => r.date))].sort();
    const days = dates.map((d) => { const rs = D.filter((r) => r.date === d); return Object.assign({date: d, est: rs.some((r) => r.basis === 'estimate')}, sumUp(rs)); });
    days.push(Object.assign({date: today, now: true}, sumUp(T)));
    const tm = (() => { const d = new Date(asOf); return isNaN(d) ? asOf : d.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}); })();
    return {today, bfs, start, tm, days, chPer, chToday, tT: sumUp(T), tP: sumUp(D.concat(T)), perLabel: bfs ? 'BFS till now (27 Nov →)' : 'Month to date'};
  };
  const cls = (v, a, b) => v == null ? '' : v < a ? 'bad' : v < b ? 'warn' : 'ok';
  const fmtD = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
  dash.draw('gp-tiles', (el) => {
    const c = window.gpCalc(); el.replaceChildren();
    const mk = (tag, cl, txt) => { const e = document.createElement(tag); if (cl) e.className = cl; if (txt != null) e.textContent = txt; return e; };
    const tiles = [
      ['Net sales (₹ lakh)', (t) => N2(t.net_lakh), 'Before returns'],
      ['After actual returns (₹ lakh)', (t) => N2(t.after), 'Returns as they happen (BFS: no exchange, no return)'],
      ['Product GP', (t) => PC(t.pgp), 'Net after returns − product cost'],
      ['Money in pocket (₹ lakh)', (t) => N2(t.contribution_lakh) + ' · ' + PC(t.cm_pct), 'CM % = ÷ net after returns, before fixed costs'],
      ['Marketing as % of net', (t) => PC(t.mkt_pct), 'Meta + Google ÷ net after returns']];
    tiles.forEach(([k, f, s]) => {
      const t = mk('div', 'lv-tile'); t.append(mk('span', 'k', k));
      const pair = mk('div', 'ly-pair'); const a = mk('div'), b = mk('div');
      a.append(mk('span', 'ly-yr', 'Today'), mk('span', 'v', c ? f(c.tT) : '—'));
      b.append(mk('span', 'ly-yr', c ? c.perLabel : 'To date'), mk('span', 'v', c ? f(c.tP) : '—'));
      pair.append(a, b); t.append(pair, mk('span', 's', s)); el.appendChild(t);
    });
  });
  dash.draw('gp-days', (tb) => {
    const c = window.gpCalc(); tb.replaceChildren(); if (!c) return;
    const th = tb.parentElement && tb.parentElement.tHead;
    if (th) { th.replaceChildren(); const r = th.insertRow(); [c.bfs ? 'Sale day' : 'Day', 'Date', 'Net sales', 'After returns', 'Product cost', 'Product GP', 'Fees, PG, shipping', 'Marketing', 'Money in pocket', 'CM %', 'Running total'].forEach((x, i) => { const e = document.createElement('th'); e.textContent = x; if (i < 2) e.className = 'l'; r.appendChild(e); }); }
    let run = 0; const s0 = Date.parse(c.start + 'T00:00:00');
    const line = (lab, date, t, opt) => { const tr = tb.insertRow(); if (opt.cls) tr.className = opt.cls;
      [[lab, 'l'], [date, 'l'], [N2(t.net_lakh)], [N2(t.after)], [N2(t.cogs_lakh)], [PC(t.pgp)], [N2(t.costs)], [N2(t.marketing_lakh)], [N2(t.contribution_lakh), t.contribution_lakh < 0 ? 'bad' : ''], [PC(t.cm_pct), cls(t.cm_pct, 0.1, 0.2)], [opt.run == null ? '' : N2(opt.run)]].forEach(([x, k]) => { const td = tr.insertCell(); td.textContent = x; if (k) td.classList.add(k); }); };
    c.days.forEach((d) => { run += d.contribution_lakh; const n = Math.round((Date.parse(d.date + 'T00:00:00') - s0) / 864e5) + 1;
      line((c.bfs ? 'Day ' : '') + n + (d.est ? '*' : ''), fmtD(d.date) + (d.now ? ' (till ' + c.tm.split(', ').pop() + ')' : ''), d, {run, cls: d.now ? 'now' : ''}); });
    line(c.perLabel, fmtD(c.start) + ' → ' + c.tm, c.tP, {cls: 'tot'});
  });
  dash.draw('gp-days-note', (el) => { const c = window.gpCalc(); el.textContent = !c ? '—' : '₹ lakh. Finished days are final; today is up to ' + c.tm + '. Money in pocket = net after returns − product cost − channel fees and PG − shipping and packing − marketing (all ad spend charged to the website); fixed costs not deducted.' + (c.days.some((d) => d.est) ? ' * Day 1 is estimated from the 10:18 pm reading, scaled to the final day sales and final ad spend; the next run replaces it with the exact figure.' : ''); });
  const perOf = () => ((dash.params() || {}).gp_per === 'bfs' ? 'bfs' : 'today');
  dash.draw('gp-ch-h', (el) => { const c = window.gpCalc(); el.textContent = 'GP by channel and store, ' + (perOf() === 'bfs' && c ? c.perLabel.replace(' (27 Nov →)', '') : 'today'); });
  dash.draw('gp-wf-h', (el) => { const c = window.gpCalc(); el.textContent = 'From net sales to money in pocket, ' + (perOf() === 'bfs' && c ? c.perLabel.replace(' (27 Nov →)', '') : 'today') + ' (₹ lakh)'; });
  dash.draw('gp-ch', (tb) => {
    const c = window.gpCalc(); tb.replaceChildren(); if (!c) return;
    const rows = (perOf() === 'bfs' ? c.chPer : c.chToday).slice().sort((a, b) => b.net_lakh - a.net_lakh);
    const tot = perOf() === 'bfs' ? c.tP : c.tT;
    rows.concat([Object.assign({channel: 'Total', tot: 1}, tot)]).forEach((r) => { const tr = tb.insertRow(); if (r.tot) tr.className = 'tot';
      [[r.channel, 'l'], [N2(r.net_lakh)], [N2(r.returns_lakh)], [N2(r.cogs_lakh)], [N2(r.fees_lakh)], [N2(r.logistics_lakh)], [N2(r.marketing_lakh)], [N2(r.contribution_lakh), r.contribution_lakh < 0 ? 'bad' : ''], [PC(r.cm_pct), cls(r.cm_pct, 0.1, 0.2)]].forEach(([x, k]) => { const td = tr.insertCell(); td.textContent = x; if (k) td.classList.add(k); }); });
  });
  dash.draw('gp-wf', (el) => {
    const c = window.gpCalc(); el.replaceChildren(); if (!c) { el.textContent = '—'; return; }
    const t = perOf() === 'bfs' ? c.tP : c.tT;
    const steps = [['Net sales', t.net_lakh, 'total'], ['Returns (actual)', -t.returns_lakh], ['Product cost', -t.cogs_lakh], ['Channel fees & PG', -t.fees_lakh], ['Shipping & packing', -t.logistics_lakh], ['Marketing', -t.marketing_lakh], ['Money in pocket', t.contribution_lakh, 'total']];
    let run = 0; const bars = steps.map(([step, v, kind]) => { let y0, y1; if (kind === 'total') { y0 = 0; y1 = v; run = v; } else { y0 = run + v; y1 = run; run += v; } return {step, v, y0: Math.min(y0, y1), y1: Math.max(y0, y1), kind: kind || 'minus'}; });
    const W = el.clientWidth || 600, H = 260, m = {t: 18, r: 8, b: 56, l: 40};
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Waterfall from net sales to money in pocket, ₹ lakh');
    const x = d3.scaleBand(bars.map((b) => b.step), [m.l, W - m.r]).padding(0.25);
    const y = d3.scaleLinear([Math.min(0, d3.min(bars, (b) => b.y0)), d3.max(bars, (b) => b.y1) * 1.08 || 1], [H - m.b, m.t]).nice();
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4)).call((g) => g.select('.domain').remove());
    svg.append('g').selectAll('rect').data(bars).join('rect').attr('x', (b) => x(b.step)).attr('width', x.bandwidth()).attr('y', (b) => y(b.y1)).attr('height', (b) => Math.max(1, y(b.y0) - y(b.y1))).attr('rx', 2).style('fill', (b) => b.kind === 'total' ? dash.colors[0] : 'var(--cds-chart-status-critical)');
    svg.append('g').selectAll('text').data(bars).join('text').attr('x', (b) => x(b.step) + x.bandwidth() / 2).attr('y', (b) => y(b.y1) - 4).attr('text-anchor', 'middle').text((b) => (b.kind === 'minus' ? '−' : '') + N2(Math.abs(b.v)));
    const lab = svg.append('g').selectAll('text').data(bars).join('text').attr('x', (b) => x(b.step) + x.bandwidth() / 2).attr('y', H - m.b + 14).attr('text-anchor', 'middle');
    lab.each(function (b) { const words = b.step.split(' '); const tx = d3.select(this); let ln = [], ts = tx.append('tspan').attr('x', x(b.step) + x.bandwidth() / 2).attr('dy', 0); const max = x.bandwidth() + 8;
      words.forEach((wd) => { ln.push(wd); ts.text(ln.join(' ')); if (ts.node().getComputedTextLength() > max && ln.length > 1) { ln.pop(); ts.text(ln.join(' ')); ln = [wd]; ts = tx.append('tspan').attr('x', x(b.step) + x.bandwidth() / 2).attr('dy', '1.1em').text(wd); } }); });
  });
})();
