"use strict";

(() => {
    const state = {
        year: 2021,
        sex: "All",
        remoteness: "All"
    };

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const format = d3.format(",");
    const tooltip = d3.select("#national-tooltip");

    let rows = [];
    let years = [];
    let frame;

    const controls = {
        year: document.getElementById("national-year"),
        sex: document.getElementById("national-sex"),
        remoteness: document.getElementById("national-remoteness"),
        reset: document.getElementById("national-reset")
    };

    function fillSelect(element, options) {
        d3.select(element)
            .selectAll("option")
            .data(options)
            .join("option")
            .attr("value", d => d)
            .text(d => d);
    }

    function filteredRows() {
        return rows.filter(d =>
            (state.sex === "All" || d.sex === state.sex) &&
            (
                state.remoteness === "All" ||
                d.remoteness === state.remoteness
            )
        );
    }

    function canvas(id, margin, label) {
        const container = document.getElementById(id);

        const width = Math.max(280, container.clientWidth);
        const height = Math.max(1, container.clientHeight);

        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr("aria-label", label);

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

    function showTooltip(event, text) {
        tooltip.text(text).attr("hidden", null);

        const box = tooltip.node().getBoundingClientRect();
        const target = event.currentTarget.getBoundingClientRect();

        const x = event.clientX || target.left + target.width / 2;
        const y = event.clientY || target.top;

        tooltip
            .style(
                "left",
                `${Math.max(
                    8,
                    Math.min(x + 12, innerWidth - box.width - 8)
                )}px`
            )
            .style(
                "top",
                `${Math.max(
                    8,
                    Math.min(y + 12, innerHeight - box.height - 8)
                )}px`
            );
    }

    function addTooltip(selection, describe) {
        selection
            .attr("tabindex", 0)
            .attr("aria-label", describe)
            .on("pointerenter pointermove", (event, d) => {
                showTooltip(event, describe(d));
            })
            .on("focus", (event, d) => {
                showTooltip(event, describe(d));
            })
            .on("pointerleave blur", () => {
                tooltip.attr("hidden", "");
            });
    }

    function drawRoad(filtered) {
        const selected = filtered.filter(d => d.year === state.year);

        const series = d3.rollups(
            selected,
            group => d3.sum(group, d => d.value),
            d => d.road
        ).map(([road, value]) => ({
            road,
            value
        })).sort((a, b) => b.value - a.value);

        const chart = canvas(
            "road-plot",
            { left: 255, right: 65, top: 4, bottom: 27 },
            `Hospitalisations by road user, ${state.year}`
        );

        document.getElementById("road-year").textContent = state.year;

        document.getElementById("road-summary").textContent =
            series.length
                ? `${series[0].road}: ` +
                  `${format(series[0].value)} hospitalisations, ` +
                  "the largest count for this selection."
                : "No records for this selection.";

        if (!series.length) return;

        const x = d3.scaleLinear()
            .domain([0, d3.max(series, d => d.value) || 1])
            .nice()
            .range([0, chart.width]);

        const y = d3.scaleBand()
            .domain(series.map(d => d.road))
            .range([0, chart.height])
            .padding(0.2);

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(
                d3.axisBottom(x)
                    .ticks(6)
                    .tickFormat(format)
            );

        const categoryAxis = chart.g.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
            .call(g => g.select(".domain").remove());

        categoryAxis.selectAll("text")
            .style("font-size", "11px");

        const bars = chart.g.selectAll(".road-bar")
            .data(series)
            .join("rect")
            .attr("class", "road-bar")
            .attr("x", 0)
            .attr("y", d => y(d.road))
            .attr("width", d => x(d.value))
            .attr("height", y.bandwidth())
            .attr("fill", "#173455");

        addTooltip(
            bars,
            d => `${d.road}, ${state.year}: ` +
                 `${format(d.value)} hospitalisations`
        );

        chart.g.selectAll(".national-value")
            .data(series)
            .join("text")
            .attr("class", "national-value")
            .attr("x", d => x(d.value) + 6)
            .attr("y", d => y(d.road) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .style("font-size", "11px")
            .text(d => format(d.value));
    }

    function drawMonths(filtered) {
        const totals = d3.rollup(
            filtered,
            group => d3.sum(group, d => d.value),
            d => d.year,
            d => d.month
        );

        const series = [];

        for (const year of years) {
            for (let month = 1; month <= 12; month++) {
                const yearTotals = totals.get(year);

                series.push({
                    year,
                    month,
                    value: yearTotals?.has(month)
                        ? yearTotals.get(month)
                        : null
                });
            }
        }

        const chart = canvas(
            "month-plot",
            { left: 50, right: 150, top: 3, bottom: 25 },
            "Monthly road-crash hospitalisations, 2011 to 2021"
        );

        const x = d3.scaleBand()
            .domain(years)
            .range([0, chart.width])
            .padding(0.025);

        const y = d3.scaleBand()
            .domain(d3.range(1, 13))
            .range([0, chart.height])
            .padding(0.04);

        const max = d3.max(series, d => d.value) || 1;

        const color = d3.scaleSequential(d3.interpolateReds)
            .domain([0, max]);

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(d3.axisBottom(x).tickSize(0).tickPadding(8));

        chart.g.append("g")
            .call(
                d3.axisLeft(y)
                    .tickSize(0)
                    .tickPadding(8)
                    .tickFormat(d => months[d - 1])
            )
            .call(g => g.select(".domain").remove())
            .selectAll("text")
            .style("font-size", "10px");

        const cells = chart.g.selectAll(".month-cell")
            .data(series)
            .join("rect")
            .attr("class", "month-cell")
            .attr("x", d => x(d.year))
            .attr("y", d => y(d.month))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .attr(
                "fill",
                d => d.value === null ? "#e6ebf1" : color(d.value)
            );

        addTooltip(
            cells,
            d => `${months[d.month - 1]} ${d.year}: ` +
                (
                    d.value === null
                        ? "No records"
                        : `${format(d.value)} hospitalisations`
                )
        );

        chart.g.append("rect")
            .attr("x", x(state.year))
            .attr("y", 0)
            .attr("width", x.bandwidth())
            .attr("height", chart.height)
            .attr("fill", "none")
            .attr("stroke", "#0b1e38")
            .attr("stroke-width", 2)
            .style("pointer-events", "none");

        const legend = chart.g.append("g")
            .attr("transform", `translate(${chart.width + 25},8)`);

        legend.append("text")
            .attr("y", 0)
            .style("font-size", "11px")
            .text("Hospitalisations");

        const legendHeight = Math.max(20, chart.height - 40);

        legend.selectAll("rect")
            .data(d3.range(40))
            .join("rect")
            .attr("x", 0)
            .attr("y", d => 16 + d * legendHeight / 40)
            .attr("width", 12)
            .attr("height", legendHeight / 40 + 0.5)
            .attr("fill", d => color(max * (1 - d / 39)));

        legend.append("text")
            .attr("x", 19)
            .attr("y", 25)
            .style("font-size", "11px")
            .text(format(max));

        legend.append("text")
            .attr("x", 19)
            .attr("y", 16 + legendHeight)
            .style("font-size", "11px")
            .text("0");
    }

    function render() {
        tooltip.attr("hidden", "");

        const filtered = filteredRows();

        document.getElementById("national-selection").textContent =
            `${state.sex === "All" ? "All sex categories" : state.sex}` +
            " · " +
            (
                state.remoteness === "All"
                    ? "All remoteness areas"
                    : state.remoteness
            ) +
            ` · Road users: ${state.year}. Heatmap retains all years.`;

        drawRoad(filtered);
        drawMonths(filtered);
    }

    async function init() {
        try {
            const source = await d3.csv(
                "data/national_road_injuries.csv"
            );

            const required = [
                "year",
                "hospitalisations",
                "month_order",
                "sex_label",
                "remoteness_label",
                "road_user_label"
            ];

            for (const column of required) {
                if (!source.columns.includes(column)) {
                    throw new Error(`Missing CSV column: ${column}`);
                }
            }

            rows = source.map(d => {
                const value = d.hospitalisations.trim();
                const year = Number(d.year);
                const month = Number(d.month_order);

                if (
                    value === "" ||
                    !Number.isFinite(Number(value)) ||
                    !Number.isFinite(year) ||
                    !Number.isInteger(month) ||
                    month < 1 ||
                    month > 12
                ) {
                    throw new Error("Invalid numeric value in the CSV.");
                }

                return {
                    year,
                    month,
                    value: Number(value),
                    sex: d.sex_label,
                    remoteness: d.remoteness_label,
                    road: d.road_user_label
                };
            });

            if (!rows.length) {
                throw new Error("The CSV is empty.");
            }

            years = [...new Set(rows.map(d => d.year))]
                .sort(d3.ascending);

            state.year = years.at(-1);

            fillSelect(controls.year, [...years].reverse());

            fillSelect(
                controls.sex,
                [
                    "All",
                    ...[...new Set(rows.map(d => d.sex))]
                        .sort(d3.ascending)
                ]
            );

            const order = [
                "Major Cities",
                "Regional",
                "Remote",
                "Unknown remoteness"
            ];

            fillSelect(
                controls.remoteness,
                [
                    "All",
                    ...[...new Set(rows.map(d => d.remoteness))]
                        .sort(
                            (a, b) =>
                                order.indexOf(a) - order.indexOf(b)
                        )
                ]
            );

            controls.year.value = String(state.year);
            controls.sex.value = "All";
            controls.remoteness.value = "All";

            document.querySelectorAll(
                "#national-filters select, #national-filters button"
            ).forEach(element => {
                element.disabled = false;
            });

            document.getElementById("national-filters")
                .addEventListener("submit", event => {
                    event.preventDefault();
                });

            controls.year.addEventListener("change", () => {
                state.year = Number(controls.year.value);
                render();
            });

            controls.sex.addEventListener("change", () => {
                state.sex = controls.sex.value;
                render();
            });

            controls.remoteness.addEventListener("change", () => {
                state.remoteness = controls.remoteness.value;
                render();
            });

            controls.reset.addEventListener("click", () => {
                state.year = years.at(-1);
                state.sex = "All";
                state.remoteness = "All";

                controls.year.value = String(state.year);
                controls.sex.value = "All";
                controls.remoteness.value = "All";

                render();
            });

            render();

            const observer = new ResizeObserver(() => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(render);
            });

            document.querySelectorAll(".national-plot")
                .forEach(plot => observer.observe(plot));

        } catch (error) {
            const message = document.getElementById(
                "national-selection"
            );

            message.textContent =
                `${error.message} Check the CSV path and use Live Server.`;

            message.style.color = "#8b0000";
            console.error(error);
        }
    }

    init();
})();