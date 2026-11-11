"use strict";
// All charts use D3 v7. Source CSVs are retained unchanged.
(() => {
    const years = Array.from({ length: 11 }, (_, i) => 2011 + i), ageOrder = ['0-7', '8-16', '17-25', '26-39', '40-64', '65+'];
    const colors = { 'Major Cities': '#173455', 'Regional': '#a82232', 'Remote': '#42979b' };
    const labels = { 'Car driver, passenger or unknown position': 'Car occupants', 'Heavy transport driver, passenger or unknown position': 'Heavy transport occupants', 'Pick-up truck or van occupant': 'Pick-up / van occupants' };
    const state = { year: 2021, status: 'First Nations people', hidden: new Set() }, data = {};
    const fmt = d3.format(','), tip = d3.select('#tooltip');
    const number = s => s !== undefined && s !== null && String(s).trim() !== '' && Number.isFinite(+s) ? +s : null;
    function annual(rows, category) {
        const cats = [...new Set(rows.map(r => r[category]))], statuses = [...new Set(rows.map(r => r.indigenous_status))];
        const grouped = d3.group(rows, r => +r.year, r => r.indigenous_status, r => r[category]), out = [];
        for (const year of years) for (const status of statuses) for (const cat of cats) {
            const part = grouped.get(year)?.get(status)?.get(cat) || [], halves = new Set(part.map(r => r.half_year));
            const complete = part.length === 2 && halves.size === 2 && halves.has('Jan-Jun') && halves.has('Jul-Dec') && part.every(r => number(r.hospitalisations) !== null);
            out.push({ year, status, cat, value: complete ? d3.sum(part, r => +r.hospitalisations) : null, complete, label: category === 'road_user' ? (labels[cat] || cat) : category === 'counterparty' ? (part[0]?.counterparty_label || cat) : cat });
        } return out;
    }
    function tooltip(event, text) { tip.text(text).attr('hidden', null); const box = tip.node().getBoundingClientRect(); const rect = event.currentTarget.getBoundingClientRect(); tip.style('left', `${Math.max(5, Math.min((event.clientX || rect.x) + 12, innerWidth - box.width - 10))}px`).style('top', `${Math.max(5, Math.min((event.clientY || rect.y) + 12, innerHeight - box.height - 10))}px`); }
    function accessible(sel, text) { sel.attr('tabindex', 0).attr('aria-label', text).on('pointerenter', function (e, d) { tooltip(e, typeof text === 'function' ? text(d) : text); }).on('pointermove', function (e, d) { tooltip(e, typeof text === 'function' ? text(d) : text); }).on('pointerleave', () => tip.attr('hidden', '')).on('focus', function (e, d) { tooltip(e, typeof text === 'function' ? text(d) : text); }).on('blur', () => tip.attr('hidden', '')); }
    function canvas(id, m) { const el = document.getElementById(id), w = Math.max(280, el.clientWidth), h = Math.max(120, el.clientHeight); d3.select(el).selectAll('*').remove(); const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img').attr('aria-label', el.closest('section').querySelector('h2').textContent); return { svg, g: svg.append('g').attr('transform', `translate(${m.l},${m.t})`), w: Math.max(20, w - m.l - m.r), h: Math.max(25, h - m.t - m.b) }; }
    const chosen = key => data[key].filter(d => d.status === state.status), current = key => chosen(key).filter(d => d.year === state.year);
    function trend() {
        const cats = Object.keys(colors), m = { l: 40, r: 14, t: 8, b: 23 }, c = canvas('trend', m), x = d3.scaleLinear().domain([2011, 2021]).range([0, c.w]), y = d3.scaleLinear().domain([0, d3.max(chosen('remoteness'), d => d.value) || 1]).nice().range([c.h, 0]);
        c.g.append('g').call(d3.axisLeft(y).ticks(4).tickSize(-c.w)).call(g => g.select('.domain').remove()); c.g.append('g').attr('transform', `translate(0,${c.h})`).call(d3.axisBottom(x).tickValues(c.w < 400 ? [2011, 2014, 2017, 2021] : years.filter((_, i) => i % 2 === 0)).tickFormat(d3.format('d')));
        c.g.append('line').attr('x1', x(state.year)).attr('x2', x(state.year)).attr('y2', c.h).attr('stroke', '#8b0000').attr('stroke-dasharray', '3,3').attr('opacity', .4);
        for (const cat of cats) {
            if (state.hidden.has(cat)) continue; const rows = chosen('remoteness').filter(d => d.cat === cat); c.g.append('path').datum(rows).attr('fill', 'none').attr('stroke', colors[cat]).attr('stroke-width', 2).attr('d', d3.line().defined(d => d.value !== null).x(d => x(d.year)).y(d => y(d.value)));
            accessible(c.g.selectAll(`.point-${cats.indexOf(cat)}`).data(rows.filter(d => d.value !== null)).join('circle').attr('cx', d => x(d.year)).attr('cy', d => y(d.value)).attr('r', d => d.year === state.year ? 4 : 2.5).attr('fill', colors[cat]), d => `${d.cat}, ${d.year}: ${fmt(d.value)} hospitalisations`);
        }
    }
    function age() {
        const rows = current('age').sort((a, b) => ageOrder.indexOf(a.cat) - ageOrder.indexOf(b.cat)), c = canvas('age', { l: 38, r: 12, t: 16, b: 25 }), x = d3.scaleBand().domain(rows.map(d => d.cat)).range([0, c.w]).padding(.28), y = d3.scaleLinear().domain([0, d3.max(rows, d => d.value) || 1]).nice().range([c.h, 0]);
        c.g.append('g').call(d3.axisLeft(y).ticks(4).tickSize(-c.w)).call(g => g.select('.domain').remove()); c.g.append('g').attr('transform', `translate(0,${c.h})`).call(d3.axisBottom(x).tickSize(0));
        accessible(c.g.selectAll('rect').data(rows.filter(d => d.value !== null)).join('rect').attr('x', d => x(d.cat)).attr('y', d => y(d.value)).attr('width', x.bandwidth()).attr('height', d => c.h - y(d.value)).attr('fill', '#173455'), d => `Age ${d.cat}: ${fmt(d.value)} hospitalisations`);
        c.g.selectAll('.value').data(rows).join('text').attr('class', d => d.value === null ? 'missing' : 'value').attr('x', d => x(d.cat) + x.bandwidth() / 2).attr('y', d => d.value === null ? c.h - 6 : y(d.value) - 5).attr('text-anchor', 'middle').text(d => d.value === null ? 'N/P' : fmt(d.value));
    }
    function road() {
        const rows = current('road').sort((a, b) => (b.value ?? -1) - (a.value ?? -1)), c = canvas('road', { l: 157, r: 42, t: 3, b: 22 }), x = d3.scaleLinear().domain([0, d3.max(rows, d => d.value) || 1]).nice().range([0, c.w]), y = d3.scaleBand().domain(rows.map(d => d.label)).range([0, c.h]).padding(.28);
        c.g.append('g').attr('transform', `translate(0,${c.h})`).call(d3.axisBottom(x).ticks(4)); c.g.append('g').call(d3.axisLeft(y).tickSize(0)).call(g => g.select('.domain').remove());
        accessible(c.g.selectAll('rect').data(rows.filter(d => d.value !== null)).join('rect').attr('y', d => y(d.label)).attr('width', d => x(d.value)).attr('height', y.bandwidth()).attr('fill', '#173455'), d => `${d.cat}: ${fmt(d.value)} hospitalisations`);
        c.g.selectAll('.value').data(rows).join('text').attr('class', d => d.value === null ? 'missing' : 'value').attr('x', d => d.value === null ? 3 : x(d.value) + 5).attr('y', d => y(d.label) + y.bandwidth() / 2).attr('dominant-baseline', 'middle').text(d => d.value === null ? 'Unavailable' : fmt(d.value));
        const unavailable = rows.filter(d => !d.complete); document.getElementById('road-note').textContent = unavailable.length ? `${unavailable.length} categories have incomplete or unpublished annual counts; these are not zero.` : 'All displayed categories have two published half-year counts.';
    }
    function heat() {
        const rows = chosen('counterparty'), cats = [...new Set(rows.map(d => d.label))], c = canvas('heat', { l: 148, r: 8, t: 6, b: 45 }), x = d3.scaleBand().domain(years).range([0, c.w]).padding(.04), y = d3.scaleBand().domain(cats).range([0, c.h]).padding(.05), max = d3.max(rows, d => d.value) || 1, color = d3.scaleSequential(d3.interpolateReds).domain([0, max]);
        c.g.append('g').attr('transform', `translate(0,${c.h})`).call(d3.axisBottom(x).tickSize(0).tickFormat(d => String(d).slice(2))); c.g.append('g').call(d3.axisLeft(y).tickSize(0)).call(g => g.select('.domain').remove());
        accessible(c.g.selectAll('rect').data(rows).join('rect').attr('x', d => x(d.year)).attr('y', d => y(d.label)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('fill', d => d.value === null ? '#e6ebf1' : color(d.value)).attr('stroke', d => d.year === state.year ? '#0b1e38' : 'none').attr('stroke-width', 1.5), d => `${d.cat}, ${d.year}: ${d.value === null ? 'Unavailable' : fmt(d.value) + ' hospitalisations'}`);
        if (x.bandwidth() > 31 && y.bandwidth() > 21) c.g.selectAll('.value').data(rows).join('text').attr('x', d => x(d.year) + x.bandwidth() / 2).attr('y', d => y(d.label) + y.bandwidth() / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').style('font-size', '8px').style('fill', d => d.value > max * .6 ? 'white' : '#172b43').style('pointer-events', 'none').text(d => d.value === null ? '—' : d.value);
        const legend = c.g.append('g').attr('transform', `translate(0,${c.h + 27})`); legend.selectAll('rect').data(d3.range(40)).join('rect').attr('x', d => d * 2).attr('width', 2).attr('height', 5).attr('fill', d => color(max * d / 39)); legend.append('text').attr('x', 86).attr('y', 6).text(`0–${fmt(max)} hospitalisations · year labels: 11 = 2011`);
    }
    function render() { tip.attr('hidden', ''); document.querySelectorAll('.selected-year').forEach(n => n.textContent = state.year); document.getElementById('selection').textContent = `${state.status} · ${state.year}. Trends retain all years.`; trend(); age(); road(); heat(); }
    function table(key) { const rows = key === 'heat' ? chosen('counterparty') : current(key), dialog = document.getElementById('data-dialog'); document.getElementById('table-title').textContent = `${state.status} — ${key === 'heat' ? 'counterparty, all years' : state.year}`; const area = d3.select('#table-content'); area.selectAll('*').remove(); const t = area.append('table'); t.append('thead').append('tr').selectAll('th').data(['Year', 'Category', 'Hospitalisations', 'Availability']).join('th').attr('scope', 'col').text(d => d); t.append('tbody').selectAll('tr').data(rows).join('tr').selectAll('td').data(d => [d.year, d.label, d.value === null ? 'Unavailable' : fmt(d.value), d.complete ? 'Complete' : 'Unavailable']).join('td').text(d => d); dialog.showModal(); }
    async function init() {
        try {
            const specs = [['age', 'age_group'], ['road_user', 'road_user'], ['remoteness', 'remoteness'], ['counterparty', 'counterparty']]; const loaded = await Promise.all(specs.map(async ([file, col]) => { const rows = await d3.csv(`data/first_nations_${file}.csv`); if (!rows.length || !rows.columns.includes(col) || !rows.columns.includes('hospitalisations')) throw Error(`Invalid ${file} CSV`); return annual(rows, col); }));[data.age, data.road, data.remoteness, data.counterparty] = loaded;
            d3.select('#year').selectAll('option').data([...years].reverse()).join('option').attr('value', d => d).text(d => d); document.getElementById('year').value = 2021; document.querySelectorAll('#filters select,#filters button').forEach(n => n.disabled = false);
            d3.select('#year').on('change', e => { state.year = +e.target.value; render(); }); d3.select('#status').on('change', e => { state.status = e.target.value; render(); }); d3.select('#filters').on('submit', e => e.preventDefault());
            function legend() { const b = d3.select('#trend-legend').selectAll('button').data(Object.keys(colors)).join('button').attr('type', 'button').attr('aria-pressed', d => !state.hidden.has(d)).on('click', (_, d) => { if (state.hidden.has(d)) state.hidden.delete(d); else if (state.hidden.size < 2) state.hidden.add(d); legend(); trend(); }); b.selectAll('*').remove(); b.append('span').attr('class', 'swatch').style('background', d => colors[d]); b.append('span').text(d => d); }
            d3.select('#reset').on('click', () => { state.year = 2021; state.status = 'First Nations people'; state.hidden.clear(); document.getElementById('year').value = 2021; document.getElementById('status').value = state.status; legend(); render(); }); legend(); document.querySelectorAll('.table-toggle').forEach(b => b.addEventListener('click', () => table(b.dataset.table))); document.getElementById('close-dialog').onclick = () => document.getElementById('data-dialog').close(); render(); let frame; new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); }).observe(document.querySelector('.charts-grid'));
        } catch (e) { document.getElementById('selection').textContent = 'Could not load dashboard data.'; d3.select('#trend').append('p').attr('class', 'error').text(`${e.message}. Open with VS Code Live Server and keep the data folder beside injuries.html.`); console.error(e); }
    }
    init();
})();
