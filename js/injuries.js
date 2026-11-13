"use strict";

(() => {
    const years = d3.range(2011, 2022);

    const ageOrder = [
        "0-7", "8-16", "17-25", "26-39", "40-64", "65+"
    ];

    const styles = {
        "Major Cities": {
            color: "#173455",
            dash: null,
            symbol: d3.symbolCircle
        },
        "Regional": {
            color: "#a82232",
            dash: "9,4",
            symbol: d3.symbolSquare
        },
        "Remote": {
            color: "#267579",
            dash: "2,4",
            symbol: d3.symbolTriangle
        }
    };

    const roadLabels = {
        "Car driver, passenger or unknown position": "Car occupants",
        "Heavy transport driver, passenger or unknown position":
            "Heavy transport occupants",
        "Pick-up truck or van occupant": "Pick-up / van occupants"
    };

    const state = {
        year: 2021,
        status: "First Nations people",
        hidden: new Set(),
        expanded: null
    };

    const data = {};
    const format = d3.format(",");
    const tip = d3.select("#tooltip");
    const grid = document.getElementById("charts");
    const dialog = document.getElementById("data-dialog");

    let tableOpener = null;
    let frame;
    let ready = false;

    function numeric(value) {
        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ""
        ) {
            return null;
        }

        return Number.isFinite(Number(value))
            ? Number(value)
            : null;
    }

    function annual(rows, category) {
        const categories = [...new Set(rows.map(d => d[category]))];

        const statuses = [
            ...new Set(rows.map(d => d.indigenous_status))
        ];

        const grouped = d3.group(
            rows,
            d => Number(d.year),
            d => d.indigenous_status,
            d => d[category]
        );

        const result = [];

        for (const year of years) {
            for (const status of statuses) {
                for (const categoryValue of categories) {
                    const part =
                        grouped.get(year)?.get(status)
                            ?.get(categoryValue) || [];

                    const halves = new Set(
                        part.map(d => d.half_year)
                    );

                    const complete =
                        part.length === 2 &&
                        halves.size === 2 &&
                        halves.has("Jan-Jun") &&
                        halves.has("Jul-Dec") &&
                        part.every(
                            d => numeric(d.hospitalisations) !== null
                        );

                    let label = categoryValue;

                    if (category === "road_user") {
                        label = roadLabels[categoryValue] || categoryValue;
                    }

                    if (category === "counterparty") {
                        label =
                            part[0]?.counterparty_label || categoryValue;
                    }

                    result.push({
                        year,
                        status,
                        cat: categoryValue,
                        label,
                        complete,
                        value: complete
                            ? d3.sum(part, d => Number(d.hospitalisations))
                            : null
                    });
                }
            }
        }

        return result;
    }

    const chosen = key =>
        data[key].filter(d => d.status === state.status);

    const current = key =>
        chosen(key).filter(d => d.year === state.year);

    function showTooltip(event, text) {
        tip.text(text).attr("hidden", null);

        const box = tip.node().getBoundingClientRect();
        const target = event.currentTarget.getBoundingClientRect();

        const x = event.clientX || target.left + target.width / 2;
        const y = event.clientY || target.top;

        tip.style(
            "left",
            `${Math.max(
                8,
                Math.min(x + 12, innerWidth - box.width - 8)
            )}px`
        ).style(
            "top",
            `${Math.max(
                8,
                Math.min(y + 12, innerHeight - box.height - 8)
            )}px`
        );
    }

    function accessible(selection, describe) {
        selection
            .attr("tabindex", 0)
            .attr("role", "img")
            .attr("aria-label", describe)
            .on("pointerenter pointermove", (event, d) => {
                showTooltip(event, describe(d));
            })
            .on("focus", (event, d) => {
                showTooltip(event, describe(d));
            })
            .on("pointerleave blur", () => {
                tip.attr("hidden", "");
            });
    }

    function canvas(id, margin) {
        const container = document.getElementById(id);

        const width = container.clientWidth;
        const height = container.clientHeight;

        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "group")
            .attr(
                "aria-label",
                container.closest("section")
                    .querySelector("h2").textContent.trim()
            );

        return {
            svg,
            g: svg.append("g")
                .attr(
                    "transform",
                    `translate(${margin.left},${margin.top})`
                ),
            width: Math.max(1, width - margin.left - margin.right),
            height: Math.max(1, height - margin.top - margin.bottom)
        };
    }

    function drawTrend() {
        const rows = chosen("remoteness");
        const expanded = state.expanded === "trend";

        const chart = canvas("trend", {
            left: 58,
            right: expanded ? 120 : 95,
            top: 13,
            bottom: 29
        });

        const x = d3.scaleLinear()
            .domain([2011, 2021])
            .range([0, chart.width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(rows, d => d.value) || 1])
            .nice()
            .range([chart.height, 0]);

        chart.g.append("g")
            .call(
                d3.axisLeft(y)
                    .ticks(chart.height < 150 ? 3 : 5)
                    .tickFormat(format)
                    .tickSize(-chart.width)
            )
            .call(g => g.select(".domain").remove());

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(
                d3.axisBottom(x)
                    .tickValues(
                        chart.width > 650
                            ? years
                            : years.filter((_, i) => i % 2 === 0)
                    )
                    .tickFormat(d3.format("d"))
            );

        chart.g.append("line")
            .attr("x1", x(state.year))
            .attr("x2", x(state.year))
            .attr("y1", 0)
            .attr("y2", chart.height)
            .attr("stroke", "#8b0000")
            .attr("stroke-dasharray", "4,4")
            .attr("opacity", 0.6);

        for (const [category, style] of Object.entries(styles)) {
            if (state.hidden.has(category)) continue;

            const series = rows.filter(d => d.cat === category);

            chart.g.append("path")
                .datum(series)
                .attr("fill", "none")
                .attr("stroke", style.color)
                .attr("stroke-width", 2.5)
                .attr("stroke-dasharray", style.dash)
                .attr(
                    "d",
                    d3.line()
                        .defined(d => d.value !== null)
                        .x(d => x(d.year))
                        .y(d => y(d.value))
                );

            const points = chart.g.append("g")
                .selectAll("path")
                .data(series.filter(d => d.value !== null))
                .join("path")
                .attr(
                    "transform",
                    d => `translate(${x(d.year)},${y(d.value)})`
                )
                .attr(
                    "d",
                    d => d3.symbol()
                        .type(style.symbol)
                        .size(d.year === state.year ? 90 : 45)()
                )
                .attr("fill", style.color);

            accessible(
                points,
                d => `${category}, ${d.year}: ` +
                    `${format(d.value)} hospitalisations`
            );

            const end = series.find(
                d => d.year === 2021 && d.value !== null
            );

           if (end && expanded) {
                chart.g.append("text")
                    .attr("x", chart.width + 8)
                    .attr("y", y(end.value))
                    .attr("dominant-baseline", "middle")
                    .style("fill", style.color)
                    .style("font-size", expanded ? "16px" : "12px")
                    .text(category);
            }
        }
    }

    function drawAge() {
        const rows = current("age").sort(
            (a, b) =>
                ageOrder.indexOf(a.cat) - ageOrder.indexOf(b.cat)
        );

        const chart = canvas("age", {
            left: 58,
            right: 12,
            top: 24,
            bottom: 29
        });

        const x = d3.scaleBand()
            .domain(rows.map(d => d.cat))
            .range([0, chart.width])
            .padding(0.25);

        const y = d3.scaleLinear()
            .domain([
                0,
                (d3.max(rows, d => d.value) || 1) * 1.12
            ])
            .nice()
            .range([chart.height, 0]);

        chart.g.append("g")
            .call(
                d3.axisLeft(y)
                    .ticks(chart.height < 150 ? 3 : 5)
                    .tickFormat(format)
                    .tickSize(-chart.width)
            )
            .call(g => g.select(".domain").remove());

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(d3.axisBottom(x).tickSize(0).tickPadding(8));

        const bars = chart.g.selectAll("rect")
            .data(rows.filter(d => d.value !== null))
            .join("rect")
            .attr("x", d => x(d.cat))
            .attr("y", d => y(d.value))
            .attr("width", x.bandwidth())
            .attr("height", d => chart.height - y(d.value))
            .attr("fill", "#173455");

        accessible(
            bars,
            d => `Age ${d.cat}, ${state.year}: ` +
                `${format(d.value)} hospitalisations`
        );

        chart.g.selectAll(".age-value")
            .data(rows)
            .join("text")
            .attr(
                "class",
                d => d.value === null ? "missing" : "value"
            )
            .attr("x", d => x(d.cat) + x.bandwidth() / 2)
            .attr(
                "y",
                d => d.value === null
                    ? chart.height - 7
                    : y(d.value) - 7
            )
            .attr("text-anchor", "middle")
            .text(
                d => d.value === null ? "N/P" : format(d.value)
            );
    }

    function drawRoad() {
        const rows = current("road").sort(
            (a, b) => (b.value ?? -1) - (a.value ?? -1)
        );

        const chart = canvas("road", {
            left: 195,
            right: 65,
            top: 5,
            bottom: 28
        });

        const x = d3.scaleLinear()
            .domain([0, d3.max(rows, d => d.value) || 1])
            .nice()
            .range([0, chart.width]);

        const y = d3.scaleBand()
            .domain(rows.map(d => d.label))
            .range([0, chart.height])
            .padding(0.25);

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(d3.axisBottom(x).ticks(4).tickFormat(format));

        chart.g.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
            .call(g => g.select(".domain").remove());

        const bars = chart.g.selectAll("rect")
            .data(rows.filter(d => d.value !== null))
            .join("rect")
            .attr("y", d => y(d.label))
            .attr("width", d => x(d.value))
            .attr("height", y.bandwidth())
            .attr("fill", "#173455");

        accessible(
            bars,
            d => `${d.label}, ${state.year}: ` +
                `${format(d.value)} hospitalisations`
        );

        chart.g.selectAll(".road-value")
            .data(rows)
            .join("text")
            .attr(
                "class",
                d => d.value === null ? "missing" : "value"
            )
            .attr(
                "x",
                d => d.value === null ? 4 : x(d.value) + 6
            )
            .attr("y", d => y(d.label) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .text(
                d => d.value === null
                    ? "Unavailable"
                    : format(d.value)
            );

        const missing = rows.filter(d => !d.complete).length;

        document.getElementById("road-note").textContent =
            missing
                ? `${missing} categories have incomplete or unpublished ` +
                  "annual counts. Unavailable does not mean zero."
                : "All categories have two published half-year counts.";
    }

    function relativeLuminance(color) {
        const rgb = d3.rgb(color);

        const channels = [rgb.r, rgb.g, rgb.b].map(value => {
            const channel = value / 255;

            return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
        });

        return (
            channels[0] * 0.2126 +
            channels[1] * 0.7152 +
            channels[2] * 0.0722
        );
    }

    function cellTextColor(background) {
        const luminance = relativeLuminance(background);

        const blackContrast = (luminance + 0.05) / 0.05;
        const whiteContrast = 1.05 / (luminance + 0.05);

        return blackContrast >= whiteContrast ? "#000000" : "#ffffff";
    }

    function drawHeat() {
        const rows = chosen("counterparty");
        const categories = [...new Set(rows.map(d => d.label))];

        const chart = canvas("heat", {
            left: 185,
            right: 12,
            top: 5,
            bottom: 62
        });

        const x = d3.scaleBand()
            .domain(years)
            .range([0, chart.width])
            .padding(0.035);

        const y = d3.scaleBand()
            .domain(categories)
            .range([0, chart.height])
            .padding(0.04);

        const maximum = d3.max(rows, d => d.value) || 1;

        const color = d3.scaleSequential(d3.interpolateReds)
            .domain([0, maximum]);

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(d3.axisBottom(x).tickSize(0).tickPadding(7));

        chart.g.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(7))
            .call(g => g.select(".domain").remove());

        const cells = chart.g.selectAll(".heat-cell")
            .data(rows)
            .join("rect")
            .attr("class", "heat-cell")
            .attr("x", d => x(d.year))
            .attr("y", d => y(d.label))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .attr(
                "fill",
                d => d.value === null ? "#e6ebf1" : color(d.value)
            );

        accessible(
            cells,
            d => `${d.label}, ${d.year}: ` +
                (
                    d.value === null
                        ? "Unavailable"
                        : `${format(d.value)} hospitalisations`
                )
        );

        // One Tab stop for the heatmap; arrow keys move within it.
        const nodes = cells.nodes();

        cells.attr("tabindex", (_, i) => i === 0 ? 0 : -1)
            .on("keydown", function (event, d) {
                const column = years.indexOf(d.year);
                const row = categories.indexOf(d.label);

                let nextColumn = column;
                let nextRow = row;

                if (event.key === "ArrowRight") nextColumn++;
                else if (event.key === "ArrowLeft") nextColumn--;
                else if (event.key === "ArrowDown") nextRow++;
                else if (event.key === "ArrowUp") nextRow--;
                else return;

                event.preventDefault();

                nextColumn = Math.max(
                    0, Math.min(years.length - 1, nextColumn)
                );

                nextRow = Math.max(
                    0, Math.min(categories.length - 1, nextRow)
                );

                const nextIndex = rows.findIndex(item =>
                    item.year === years[nextColumn] &&
                    item.label === categories[nextRow]
                );

                if (nextIndex >= 0) {
                    cells.attr("tabindex", -1);
                    nodes[nextIndex].setAttribute("tabindex", "0");
                    nodes[nextIndex].focus();
                }
            });

        chart.g.append("rect")
            .attr("x", x(state.year))
            .attr("y", 0)
            .attr("width", x.bandwidth())
            .attr("height", chart.height)
            .attr("fill", "none")
            .attr("stroke", "#0b1e38")
            .attr("stroke-width", 2)
            .style("pointer-events", "none");

        // Only show numbers when cells have enough room.
        if (x.bandwidth() >= 44 && y.bandwidth() >= 25) {
            chart.g.selectAll(".heat-value")
                .data(rows)
                .join("text")
                .attr("class", "heat-value")
                .attr("x", d => x(d.year) + x.bandwidth() / 2)
                .attr("y", d => y(d.label) + y.bandwidth() / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style(
                    "fill",
                    d => d.value === null
                        ? "#172b43"
                        : cellTextColor(color(d.value))
                )
                .style("font-size", "14px")
                .style("pointer-events", "none")
                .text(d => d.value === null ? "—" : format(d.value));
        }

        const legend = chart.g.append("g")
            .attr(
                "transform",
                `translate(0,${chart.height + 36})`
            );

        legend.selectAll("rect")
            .data(d3.range(80))
            .join("rect")
            .attr("x", d => d * 1.5)
            .attr("width", 1.6)
            .attr("height", 10)
            .attr("fill", d => color(maximum * d / 79));

        legend.append("text")
            .attr("x", 130)
            .attr("y", 10)
            .style("font-size", "12px")
            .text(`0–${format(maximum)} hospitalisations`);
    }

    const drawers = {
        trend: drawTrend,
        age: drawAge,
        road: drawRoad,
        heat: drawHeat
    };

    function render() {
        if (!ready) return;

        tip.attr("hidden", "");

        document.querySelectorAll(".selected-year").forEach(element => {
            element.textContent = state.year;
        });

        document.getElementById("selection").textContent =
            `${state.status} · ${state.year}. ` +
            "Trend and counterparty retain all years.";

        for (const [key, draw] of Object.entries(drawers)) {
            if (!state.expanded || state.expanded === key) {
                draw();
            }
        }
    }

    function scheduleRender() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
    }

    function setExpanded(key) {
        state.expanded = key;
        grid.classList.toggle("is-expanded", Boolean(key));

        document.querySelectorAll(".chart-card").forEach(card => {
            const active = card.dataset.key === key;
            card.hidden = Boolean(key) && !active;
            card.classList.toggle("is-expanded", active);
        });

        document.querySelectorAll(".expand-toggle").forEach(button => {
            const active = button.dataset.expand === key;

            button.setAttribute("aria-expanded", String(active));
            button.textContent = active ? "Close view" : "Expand";
        });

        scheduleRender();
    }

    function buildLegend() {
        const buttons = d3.select("#trend-legend")
            .selectAll("button")
            .data(Object.keys(styles))
            .join("button")
            .attr("type", "button")
            .attr("aria-pressed", d => !state.hidden.has(d))
            .on("click", (_, category) => {
                if (state.hidden.has(category)) {
                    state.hidden.delete(category);
                } else if (state.hidden.size < 2) {
                    state.hidden.add(category);
                }

                buildLegend();
                drawTrend();
            });

        buttons.selectAll("*").remove();

        buttons.each(function (category) {
            const style = styles[category];

            const icon = d3.select(this)
                .append("svg")
                .attr("width", 34)
                .attr("height", 18)
                .attr("aria-hidden", "true");

            icon.append("line")
                .attr("x1", 0)
                .attr("x2", 34)
                .attr("y1", 9)
                .attr("y2", 9)
                .attr("stroke", style.color)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", style.dash);

            icon.append("path")
                .attr("transform", "translate(17,9)")
                .attr(
                    "d",
                    d3.symbol().type(style.symbol).size(40)()
                )
                .attr("fill", style.color);

            d3.select(this).append("span").text(category);
        });
    }

    function openTable(key, opener) {
        tableOpener = opener;

        let rows;

        if (key === "trend") {
            rows = chosen("remoteness")
                .filter(d => !state.hidden.has(d.cat));
        } else if (key === "heat") {
            rows = chosen("counterparty");
        } else {
            rows = current(key);
        }

        const titles = {
            trend: "Hospitalisations by remoteness",
            age: "Hospitalisations by age",
            road: "Hospitalisations by road user",
            heat: "Hospitalisations by counterparty"
        };

        document.getElementById("table-title").textContent =
            `${titles[key]} — ${state.status}`;

        const area = d3.select("#table-content");
        area.selectAll("*").remove();

        const table = area.append("table");

        table.append("caption")
            .text(
                key === "trend" || key === "heat"
                    ? "Annual counts, 2011–2021"
                    : `Annual counts, ${state.year}`
            );

        table.append("thead")
            .append("tr")
            .selectAll("th")
            .data([
                "Year", "Category", "Hospitalisations", "Availability"
            ])
            .join("th")
            .attr("scope", "col")
            .text(d => d);

        table.append("tbody")
            .selectAll("tr")
            .data(rows)
            .join("tr")
            .selectAll("td")
            .data(d => [
                d.year,
                d.label,
                d.value === null ? "Unavailable" : format(d.value),
                d.complete ? "Complete" : "Unavailable"
            ])
            .join("td")
            .text(d => d);

        tip.attr("hidden", "");
        dialog.showModal();
        document.getElementById("close-dialog").focus();
    }

    async function init() {
        try {
            const specifications = [
                ["age", "age_group"],
                ["road_user", "road_user"],
                ["remoteness", "remoteness"],
                ["counterparty", "counterparty"]
            ];

            const loaded = await Promise.all(
                specifications.map(async ([file, category]) => {
                    const rows = await d3.csv(
                        `data/first_nations_${file}.csv`
                    );

                    const required = [
                        "year",
                        "half_year",
                        "indigenous_status",
                        "hospitalisations",
                        category
                    ];

                    if (
                        !rows.length ||
                        required.some(
                            column => !rows.columns.includes(column)
                        )
                    ) {
                        throw new Error(`Invalid ${file} CSV`);
                    }

                    return annual(rows, category);
                })
            );

            [
                data.age,
                data.road,
                data.remoteness,
                data.counterparty
            ] = loaded;

            d3.select("#year")
                .selectAll("option")
                .data([...years].reverse())
                .join("option")
                .attr("value", d => d)
                .text(d => d);

            const statuses = [
                ...new Set(data.age.map(d => d.status))
            ];

            d3.select("#status")
                .selectAll("option")
                .data(statuses)
                .join("option")
                .attr("value", d => d)
                .text(d => d);

            if (!statuses.includes(state.status)) {
                state.status = statuses[0];
            }

            document.getElementById("year").value = state.year;
            document.getElementById("status").value = state.status;

            document.querySelectorAll(
                "#filters select, #filters button"
            ).forEach(element => {
                element.disabled = false;
            });

            document.getElementById("filters")
                .addEventListener("submit", event => {
                    event.preventDefault();
                });

            document.getElementById("year")
                .addEventListener("change", event => {
                    state.year = Number(event.target.value);
                    render();
                });

            document.getElementById("status")
                .addEventListener("change", event => {
                    state.status = event.target.value;
                    render();
                });

            document.getElementById("reset")
                .addEventListener("click", () => {
                    state.year = 2021;
                    state.status = statuses.includes("First Nations people")
                        ? "First Nations people"
                        : statuses[0];

                    state.hidden.clear();

                    document.getElementById("year").value = state.year;
                    document.getElementById("status").value = state.status;

                    buildLegend();
                    render();
                });

            document.querySelectorAll(".expand-toggle")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        setExpanded(
                            state.expanded === button.dataset.expand
                                ? null
                                : button.dataset.expand
                        );
                    });
                });

            document.querySelectorAll(".table-toggle")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        openTable(button.dataset.table, button);
                    });
                });

            document.getElementById("close-dialog")
                .addEventListener("click", () => dialog.close());

            dialog.addEventListener("close", () => {
                tableOpener?.focus();
            });

            document.addEventListener("keydown", event => {
                if (event.key !== "Escape" || dialog.open) return;

                tip.attr("hidden", "");

                if (state.expanded) {
                    const key = state.expanded;

                    setExpanded(null);

                    document.querySelector(
                        `[data-expand="${key}"]`
                    ).focus();
                }
            });

            ready = true;
            buildLegend();
            render();

            const observer = new ResizeObserver(scheduleRender);

            document.querySelectorAll(".plot").forEach(plot => {
                observer.observe(plot);
            });

        } catch (error) {
            document.getElementById("selection").textContent =
                `${error.message}. Check the CSV files and use Live Server.`;

            document.getElementById("selection")
                .classList.add("error");

            console.error(error);
        }
    }

    init();
})();