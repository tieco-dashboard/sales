// BFS 2026 vs BFS 2025 (Shopify website), like-for-like by sale day and IST hour.
// Data: ly_hour (one row per sale day + IST hour, ty_/ly_ metrics), ly_meta (as_of, sale_day, last_hour),
// ly_split (order counts by payment mode, cancellations, RTO for BFS so far), ly_inv (clothing stock by day), ly_top (top 10 per year).
(function () {
  const FNS = {};
  const INR = (v) => { if (v == null || !isFinite(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' Cr'; if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2) + ' L'; return s + '₹' + Math.round(a).toLocaleString('en-IN'); };
  const N = (v) => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-IN');
  const P = (v, d) => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d == null ? 1 : d) + '%';
  const KIND = {total: 'inr', gross: 'inr', aov: 'inr', dom_total: 'inr', intl_total: 'inr', orders: 'int', units: 'int', sessions: 'int', dom_orders: 'int', intl_orders: 'int', disc_pct: 'pct', conv: 'pct2', intl_share: 'pct'};
  const GOOD = {total: 1, gross: 1, aov: 1, dom_total: 1, intl_total: 1, orders: 1, units: 1, sessions: 1, dom_orders: 1, intl_orders: 1, conv: 1};
  const fmt = (k, v) => KIND[k] === 'inr' ? INR(v) : KIND[k] === 'pct' ? P(v) : KIND[k] === 'pct2' ? P(v, 2) : N(v);
  window.lyFmt = fmt;
  const meta = () => { const m = dash.data('ly_meta'); return m.status === 'ok' && m.data[0] ? m.data[0] : null; };
  // Which rows count: 'lfl' = every sale day before today + today's completed hours; a day number = that day (hours lyhs..lyhe-1).
  window.lySpec = () => {
    const p = dash.params() || {}, m = meta() || {sale_day: 1, last_hour: 23};
    const day = p.ly_day || 'lfl';
    let hs = +p.ly_hs || 0, he = p.ly_he == null || p.ly_he === '' ? 24 : +p.ly_he; if (he <= hs) he = Math.min(24, hs + 1);
    if (day === 'lfl') return {day, test: (r) => r.day < m.sale_day || (r.day === m.sale_day && r.hour <= m.last_hour), m};
    const d = +day;
    const cap = d === m.sale_day ? m.last_hour : 23;
    return {day, d, hs, he, test: (r) => r.day === d && r.hour >= hs && r.hour < he && (p.ly_full === '1' || r.hour <= cap), m};
  };
  window.lyKpi = () => {
    const h = dash.data('ly_hour'); if (h.status !== 'ok') return null;
    const s = window.lySpec(); const rows = h.data.filter(s.test);
    const sum = (y, k) => rows.reduce((a, r) => a + (+r[y + '_' + k] || 0), 0);
    const one = (y) => { const o = sum(y, 'orders'), g = sum(y, 'gross'), d = sum(y, 'disc'), t = sum(y, 'total'), se = sum(y, 'sessions'), dt = sum(y, 'dom_total'), dor = sum(y, 'dom_orders');
      return {total: t, gross: g, orders: o, units: sum(y, 'units'), sessions: se, aov: o ? (g + d) / o : null, disc_pct: g ? -d / g : null, conv: se ? o / se : null, dom_total: dt, dom_orders: dor, intl_total: t - dt, intl_orders: o - dor, intl_share: t ? (t - dt) / t : null}; };
    const ty = one('ty'), ly = one('ly'); const out = {};
    Object.keys(ty).forEach((k) => { const pts = KIND[k] === 'pct' || KIND[k] === 'pct2'; out[k] = {ty: ty[k], ly: ly[k], chg: ty[k] == null || ly[k] == null ? null : pts ? ty[k] - ly[k] : (ly[k] ? ty[k] / ly[k] - 1 : null)}; });
    return {k: out, n: rows.length};
  };
  const chgText = (k, c) => { if (c == null || !isFinite(c)) return 'no 2025 base'; const pts = KIND[k] === 'pct' || KIND[k] === 'pct2'; const sg = c > 0 ? '+' : c < 0 ? '−' : '±'; return pts ? sg + Math.abs(c * 100).toFixed(KIND[k] === 'pct2' ? 2 : 1) + ' pts vs 2025' : sg + Math.abs(c * 100).toFixed(1) + '% vs 2025'; };
  FNS['ly-k'] = (el) => {
    const r = window.lyKpi(); const k = el.dataset.k, f = el.dataset.f;
    if (!r || !r.k[k]) { el.textContent = '—'; return; }
    const v = r.k[k];
    if (f === 'chg') { el.textContent = chgText(k, v.chg); el.classList.remove('ok', 'bad'); const dir = GOOD[k] || 0; if (dir && v.chg != null && Math.abs(v.chg) >= 0.0005) el.classList.add(v.chg * dir > 0 ? 'ok' : 'bad'); return; }
    if (f === 'word') { el.textContent = v.chg == null ? 'not comparable' : Math.abs(v.chg) < 0.0005 ? 'flat' : (v.chg > 0 ? 'up ' : 'down ') + Math.abs(v.chg * 100).toFixed(1) + '%'; return; }
    el.textContent = fmt(k, v[f]);
  };

  // Tile groups drawn as a whole (keeps the page markup short). Each tile: label, 2025 value, 2026 value, change line.
  const SETS = {
    sales: [['total', 'Total sales (Shopify, incl. GST, after returns)'], ['gross', 'Gross sales'], ['orders', 'Orders'], ['aov', 'AOV'], ['disc_pct', 'Average discount %'], ['units', 'Units ordered']],
    traffic: [['sessions', 'Sessions'], ['conv', 'Conversion rate (orders ÷ sessions)'], ['dom_total', 'Domestic total sales'], ['intl_total', 'International total sales'], ['intl_share', 'International share of sales']],
    pay: [['prepaid_share', 'Prepaid share'], ['cod_share', 'COD share'], ['cod_orders', 'COD orders'], ['sc_orders', 'Store credit orders'], ['cx_rate', 'Cancelled before shipping, % of orders'], ['rto_rate', 'RTO, % of orders'], ['rto_cod_rate', 'COD RTO rate']],
    inv: [['open', 'Opening clothing stock (units)'], ['close', 'Closing clothing stock (units)'], ['sold', 'Clothing units sold']]
  };
  const DRAW = {sales: 'ly-k', traffic: 'ly-k', pay: 'ly-p', inv: 'ly-i'};
  dash.draw('ly-tiles', (el) => {
    const set = el.dataset.set, fn = FNS[DRAW[set]];
    el.replaceChildren(...SETS[set].map(([k, label]) => {
      const t = document.createElement('div'); t.className = 'lv-tile';
      const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
      const val = (f, cls) => { const e = mk('span', cls); e.dataset.k = k; e.dataset.f = f; fn(e); return e; };
      const pair = mk('div', 'ly-pair'); const a = mk('div'), b = mk('div');
      a.append(mk('span', 'ly-yr', 'BFS 2025'), val('ly', 'v ly-old')); b.append(mk('span', 'ly-yr', 'BFS 2026'), val('ty', 'v')); pair.append(a, b);
      t.append(mk('span', 'k', label), pair); if (set !== 'inv') t.append(val('chg', 's'));
      return t;
    }));
  });
  const IST = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'];
  dash.draw('ly-win', (el) => {
    const s = window.lySpec(); const m = s.m; if (!meta()) { el.textContent = '—'; return; }
    const lab = (d, y) => { const n = (y === 26 ? 26 : 27) + d; return n > 30 ? (n - 30) + ' Dec' : n + ' Nov'; };
    if (s.day === 'lfl') { el.textContent = '2026: 27 Nov 00:00 → ' + lab(m.sale_day, 26) + ' ' + IST[m.last_hour + 1] + ':00 · 2025: 28 Nov 00:00 → ' + lab(m.sale_day, 25) + ' ' + IST[m.last_hour + 1] + ':00 IST (same sale days and hours)'; return; }
    const end = s.d === m.sale_day ? Math.min(s.he, m.last_hour + 1) : s.he;
    el.textContent = 'Day ' + s.d + ' · 2026: ' + lab(s.d, 26) + ', 2025: ' + lab(s.d, 25) + ' · ' + IST[s.hs] + ':00 → ' + IST[end] + ':00 IST' + (s.d === m.sale_day && s.he > m.last_hour + 1 ? ' (today so far)' : '');
  });
  dash.draw('ly-take', (el) => {
    const r = window.lyKpi(); if (!r) { el.textContent = '—'; return; }
    const t = r.k.total, o = r.k.orders, c = r.k.conv, se = r.k.sessions;
    const w = (v) => v.chg == null ? 'not comparable' : (v.chg >= 0 ? 'up ' : 'down ') + Math.abs(v.chg * 100).toFixed(0) + '%';
    el.textContent = 'Website total sales ' + INR(t.ty) + ', ' + w(t) + ' on last year (' + INR(t.ly) + ') for the same sale days and hours. Orders ' + w(o) + ', sessions ' + w(se) + ', conversion ' + P(c.ty, 2) + ' vs ' + P(c.ly, 2) + ' last year.';
  });
  dash.draw('ly-chart', (el) => {
    const h = dash.data('ly_hour'); el.replaceChildren();
    if (h.status !== 'ok') { el.textContent = '—'; return; }
    const s = window.lySpec(), metric = (dash.params() || {}).ly_metric || 'total';
    const byHour = s.day !== 'lfl';
    const keys = byHour ? d3.range(0, 24) : d3.range(1, 12);
    const acc = new Map(keys.map((k) => [k, {ty: {}, ly: {}, in: false}]));
    const add = (o, r, y) => ['orders', 'gross', 'disc', 'units', 'total', 'sessions'].forEach((f) => { o[f] = (o[f] || 0) + (+r[y + '_' + f] || 0); });
    h.data.forEach((r) => { if (byHour ? r.day !== s.d : false) return; const a = acc.get(byHour ? r.hour : r.day); if (!a) return;
      const today = r.day === s.m.sale_day && r.hour > s.m.last_hour; if (byHour || !today) add(a.ly, r, 'ly'); if (!today) add(a.ty, r, 'ty'); if (s.test(r)) a.in = true; });
    const val = (x) => { if (x.orders == null) return null; if (metric === 'total') return x.total; if (metric === 'orders') return x.orders; if (metric === 'sessions') return x.sessions; if (metric === 'units') return x.units;
      if (metric === 'conv') return x.sessions ? x.orders / x.sessions : null; if (metric === 'aov') return x.orders ? (x.gross + x.disc) / x.orders : null; if (metric === 'disc_pct') return x.gross ? -x.disc / x.gross : null; return null; };
    const dayHas = new Set(h.data.map((r) => r.day));
    const pts = keys.map((k) => { const a = acc.get(k); const hasTy = byHour ? !(s.d === s.m.sale_day && k > s.m.last_hour) : dayHas.has(k); return {k, ty: hasTy ? val(a.ty) : null, ly: dayHas.has(byHour ? s.d : k) ? val(a.ly) : null, in: a.in}; });
    const yf = (v) => metric === 'total' || metric === 'aov' ? INR(v) : metric === 'conv' ? P(v, 2) : metric === 'disc_pct' ? P(v, 0) : N(v);
    const W = el.clientWidth || 600, H = 260, m = {t: 10, r: 10, b: 26, l: 64};
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'BFS 2026 against BFS 2025 by ' + (byHour ? 'hour' : 'sale day'));
    const y = d3.scaleLinear([0, (d3.max(pts, (d) => Math.max(d.ty || 0, d.ly || 0)) || 1) * 1.05], [H - m.b, m.t]).nice();
    const x = d3.scaleBand(keys, [m.l, W - m.r]).padding(byHour ? 0.1 : 0.2);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(yf)).call((g) => g.select('.domain').remove());
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(keys.filter((k, i) => !byHour || i % 2 === 0)).tickFormat((k) => byHour ? IST[k] : 'D' + k));
    if (byHour) {
      svg.append('g').selectAll('rect').data(pts.filter((d) => d.in)).join('rect').attr('x', (d) => x(d.k)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'currentColor').style('opacity', 0.05);
      const line = (f) => d3.line().defined((d) => d[f] != null).x((d) => x(d.k) + x.bandwidth() / 2).y((d) => y(d[f]));
      svg.append('path').datum(pts).attr('d', line('ly')).attr('fill', 'none').style('stroke', '#9a9890').attr('stroke-width', 2);
      svg.append('path').datum(pts).attr('d', line('ty')).attr('fill', 'none').style('stroke', dash.colors[0]).attr('stroke-width', 2.5);
    } else {
      const inner = d3.scaleBand(['ly', 'ty'], [0, x.bandwidth()]).padding(0.08);
      ['ly', 'ty'].forEach((f) => svg.append('g').selectAll('rect').data(pts.filter((d) => d[f] != null)).join('rect').attr('x', (d) => x(d.k) + inner(f)).attr('width', inner.bandwidth()).attr('y', (d) => y(d[f])).attr('height', (d) => Math.max(0, y(0) - y(d[f]))).attr('rx', 2).style('fill', f === 'ty' ? dash.colors[0] : '#9a9890'));
    }
    let tip = el.querySelector('.lv-tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'lv-tip'; tip.hidden = true; el.appendChild(tip); }
    svg.append('g').selectAll('rect').data(pts).join('rect').attr('x', (d) => x(d.k)).attr('width', x.bandwidth()).attr('y', 0).attr('height', H).style('fill', 'transparent')
      .on('pointerenter', (e, d) => { tip.hidden = false; tip.textContent = (byHour ? IST[d.k] + ':00' : 'Day ' + d.k) + ' · 2026 ' + (d.ty == null ? '—' : yf(d.ty)) + ' · 2025 ' + (d.ly == null ? '—' : yf(d.ly)); tip.style.left = Math.min(x(d.k), W - 260) + 'px'; tip.style.top = '0px'; })
      .on('pointerleave', () => { tip.hidden = true; });
  });
  const split = (y) => { const s = dash.data('ly_split'); return s.status === 'ok' ? s.data.find((r) => +r.year === y) : null; };
  const PAY = {
    prepaid_orders: (o) => o.orders - o.cod - o.store_credit, prepaid_share: (o) => (o.orders - o.cod - o.store_credit) / o.orders, cod_orders: (o) => o.cod, cod_share: (o) => o.cod / o.orders,
    sc_orders: (o) => o.store_credit, cx_orders: (o) => o.cancelled, cx_rate: (o) => o.cancelled / o.orders, rto_orders: (o) => o.rto, rto_rate: (o) => o.rto / o.orders, rto_cod_rate: (o) => o.cod ? o.rto_cod / o.cod : null};
  const PCT = new Set(['prepaid_share', 'cod_share', 'cx_rate', 'rto_rate', 'rto_cod_rate']);
  const BAD = new Set(['cx_orders', 'cx_rate', 'rto_orders', 'rto_rate', 'rto_cod_rate', 'cod_share']);
  FNS['ly-p'] = (el) => {
    const k = el.dataset.k, f = el.dataset.f, a = split(2026), b = split(2025);
    if (!a || !b) { el.textContent = '—'; return; }
    const t = PAY[k](a), l = PAY[k](b);
    if (f === 'ty' || f === 'ly') { const v = f === 'ty' ? t : l; el.textContent = PCT.has(k) ? P(v) : N(v); return; }
    const c = PCT.has(k) ? t - l : (l ? t / l - 1 : null);
    el.textContent = c == null ? 'no 2025 base' : (c >= 0 ? '+' : '−') + Math.abs(c * 100).toFixed(1) + (PCT.has(k) ? ' pts' : '%') + ' vs 2025';
    el.classList.remove('ok', 'bad'); if (c != null && Math.abs(c) > 0.0005) el.classList.add((c > 0) === BAD.has(k) ? 'bad' : 'ok');
  };
  dash.draw('ly-pwin', (el) => { const a = split(2026), b = split(2025); el.textContent = a && b ? '2026: ' + a.window + ' · 2025: ' + b.window + ' IST' : '—'; });
  FNS['ly-i'] = (el) => {
    const d = dash.data('ly_inv'); if (d.status !== 'ok' || !d.data.length) { el.textContent = '—'; return; }
    const rows = d.data.slice().sort((a, b) => a.day - b.day), k = el.dataset.k, y = el.dataset.f;
    const v = k === 'open' ? rows[0][y + '_open'] : k === 'close' ? rows[rows.length - 1][y + '_close'] : rows.reduce((a, r) => a + (+r[y + '_sold'] || 0), 0);
    el.textContent = N(v);
  };
  dash.draw('ly-top', (tb) => {
    const d = dash.data('ly_top'), y = +tb.dataset.y; tb.replaceChildren();
    if (d.status !== 'ok') return;
    d.data.filter((r) => +r.year === y).sort((a, b) => a.rank - b.rank).forEach((r) => { const tr = tb.insertRow();
      [[r.rank, 0], [r.product_title, 1], [N(r.units), 0], [N(r.orders), 0], [INR(r.gross_sales), 0]].forEach(([t, l]) => { const td = tr.insertCell(); td.textContent = t; if (l) { td.className = 'l w'; } }); });
  });
  document.querySelectorAll('.ly-sw-ty').forEach((s) => { s.style.background = dash.colors[0]; });
  dash.draw('ly-asof', (el) => { const m = meta(); el.textContent = m ? window.lvTime ? window.lvTime(m.as_of) : m.as_of : '—'; });
})();
