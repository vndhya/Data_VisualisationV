"use strict";

(() => {
    const state = {
        year: 2021,
        sex: "All",
        remoteness: "All"
    };

    const format = d3.format(",");
    const tooltip = d3.select("#national-tooltip");

    let rows = [];
    let years = [];
    let resizeFrame;

    const elements = {
        year: document.getElementById("national-year"),
        sex: document.getElementById("national-sex"),
        remoteness: document.getElementById("national-remoteness"),
        reset: document.getElementById("national-reset"),
        selection: document.getElementById("national-selection")
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

        const g = svg.append("g")
            .attr(
                "transform",
                `translate(${margin.left},${margin.top})`
            );

        return {
            svg,
            g,
            width: width - margin.left - margin.right,
            height: height - margin.top - margin.bottom
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

    function emptyMessage(chart) {
        chart.g.append("text")
            .attr("x", chart.width / 2)
            .attr("y", chart.height / 2)
            .attr("text-anchor", "middle")
            .text("No records for this selection.");
    }

    function drawTrend(filtered) {
        const totals = d3.rollup(
            filtered,
            group => d3.sum(group, d => d.value),
            d => d.year
        );

        const series = years.map(year => ({
            year,
            value: totals.has(year) ? totals.get(year) : null
        }));

        const chart = canvas(
            "national-trend",
            { left: 62, right: 22, top: 20, bottom: 38 },
            "Annual road-crash hospitalisations, 2011 to 2021"
        );

        const selected = series.find(d => d.year === state.year);

        document.getElementById("national-trend-summary").textContent =
            selected?.value !== null && selected?.value !== undefined
                ? `${format(selected.value)} hospitalisations in ` +
                  `${state.year} for the selected population.`
                : `No records for ${state.year} with these filters.`;

        if (!filtered.length) {
            emptyMessage(chart);
            return;
        }

        const x = d3.scaleLinear()
            .domain(d3.extent(years))
            .range([0, chart.width]);

        const y = d3.scaleLinear()
            .domain([
                0,
                (d3.max(series, d => d.value) || 1) * 1.08
            ])
            .nice()
            .range([chart.height, 0]);

        chart.g.append("g")
            .call(
                d3.axisLeft(y)
                    .ticks(5)
                    .tickFormat(format)
                    .tickSize(-chart.width)
            )
            .call(g => g.select(".domain").remove());

        const tickYears = chart.width < 480
            ? years.filter((_, index) => index % 2 === 0)
            : years;

        chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(
                d3.axisBottom(x)
                    .tickValues(tickYears)
                    .tickFormat(d3.format("d"))
                    .tickPadding(8)
            );

        chart.g.append("line")
            .attr("x1", x(state.year))
            .attr("x2", x(state.year))
            .attr("y1", 0)
            .attr("y2", chart.height)
            .attr("stroke", "#a82232")
            .attr("stroke-dasharray", "4,4")
            .attr("opacity", 0.55);

        chart.g.append("path")
            .datum(series)
            .attr("fill", "none")
            .attr("stroke", "#173455")
            .attr("stroke-width", 3)
            .attr(
                "d",
                d3.line()
                    .defined(d => d.value !== null)
                    .x(d => x(d.year))
                    .y(d => y(d.value))
            );

        const points = chart.g.selectAll(".national-point")
            .data(series.filter(d => d.value !== null))
            .join("circle")
            .attr("class", "national-point")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.value))
            .attr("r", d => d.year === state.year ? 6 : 4)
            .attr(
                "fill",
                d => d.year === state.year ? "#a82232" : "#173455"
            )
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);

        addTooltip(
            points,
            d => `${d.year}: ${format(d.value)} hospitalisations`
        );

        if (selected && selected.value !== null) {
            chart.g.append("text")
                .attr("class", "national-value")
                .attr("x", x(selected.year))
                .attr("y", y(selected.value) - 13)
                .attr(
                    "text-anchor",
                    selected.year === years.at(-1)
                        ? "end"
                        : selected.year === years[0]
                            ? "start"
                            : "middle"
                )
                .text(format(selected.value));
        }
    }

    function drawAge(filtered) {
        const selectedRows = filtered.filter(
            d => d.year === state.year
        );

        const groups = d3.rollups(
            selectedRows,
            group => ({
                value: d3.sum(group, d => d.value),
                order: d3.min(group, d => d.ageOrder)
            }),
            d => d.age
        );

        const series = groups.map(([age, result]) => ({
            age,
            ...result
        })).sort((a, b) => a.order - b.order);

        document.getElementById("national-age-year").textContent =
            state.year;

        const chart = canvas(
            "national-age",
            { left: 62, right: 18, top: 28, bottom: 48 },
            `Road-crash hospitalisations by age group, ${state.year}`
        );

        const largest = d3.greatest(series, d => d.value);

        document.getElementById("national-age-summary").textContent =
            largest
                ? `Age ${largest.age} accounts for the most ` +
                  `hospitalisations: ${format(largest.value)}.`
                : "No records for this year and filter combination.";

        if (!series.length) {
            emptyMessage(chart);
            return;
        }

        const x = d3.scaleBand()
            .domain(series.map(d => d.age))
            .range([0, chart.width])
            .padding(0.25);

        const y = d3.scaleLinear()
            .domain([
                0,
                (d3.max(series, d => d.value) || 1) * 1.15
            ])
            .nice()
            .range([chart.height, 0]);

        chart.g.append("g")
            .call(
                d3.axisLeft(y)
                    .ticks(5)
                    .tickFormat(format)
                    .tickSize(-chart.width)
            )
            .call(g => g.select(".domain").remove());

        const axis = chart.g.append("g")
            .attr("transform", `translate(0,${chart.height})`)
            .call(
                d3.axisBottom(x)
                    .tickSize(0)
                    .tickPadding(12)
            );

        axis.selectAll(".tick text")
            .filter(d => d === "Unknown age")
            .text("Unknown");

        const bars = chart.g.selectAll(".national-bar")
            .data(series)
            .join("rect")
            .attr("class", "national-bar")
            .attr("x", d => x(d.age))
            .attr("y", d => y(d.value))
            .attr("width", x.bandwidth())
            .attr("height", d => chart.height - y(d.value))
            .attr("fill", "#173455");

        addTooltip(
            bars,
            d => `Age ${d.age}, ${state.year}: ` +
                 `${format(d.value)} hospitalisations`
        );

        chart.g.selectAll(".national-value")
            .data(series)
            .join("text")
            .attr("class", "national-value")
            .attr("x", d => x(d.age) + x.bandwidth() / 2)
            .attr("y", d => y(d.value) - 8)
            .attr("text-anchor", "middle")
            .text(d => format(d.value));
    }

    function render() {
        tooltip.attr("hidden", "");

        const filtered = filteredRows();

        const sexText = state.sex === "All"
            ? "All sex categories"
            : state.sex;

        const remotenessText = state.remoteness === "All"
            ? "All remoteness areas"
            : state.remoteness;

        elements.selection.textContent =
            `${sexText} · ${remotenessText} · ` +
            `Age chart: ${state.year}. Trend retains all years.`;

        drawTrend(filtered);
        drawAge(filtered);
    }

    async function init() {
        try {
            const source = await d3.csv(
                "data/national_road_injuries.csv"
            );

            const required = [
                "year",
                "hospitalisations",
                "sex_label",
                "remoteness_label",
                "age_group_label",
                "age_order"
            ];

            for (const column of required) {
                if (!source.columns.includes(column)) {
                    throw new Error(`Missing CSV column: ${column}`);
                }
            }

            rows = source.map(d => {
                const count = d.hospitalisations.trim();

                if (
                    count === "" ||
                    !Number.isFinite(Number(count)) ||
                    !Number.isFinite(Number(d.year)) ||
                    !Number.isFinite(Number(d.age_order))
                ) {
                    throw new Error(
                        "The CSV contains a missing or invalid numeric value."
                    );
                }

                return {
                    year: Number(d.year),
                    value: Number(count),
                    sex: d.sex_label,
                    remoteness: d.remoteness_label,
                    age: d.age_group_label,
                    ageOrder: Number(d.age_order)
                };
            });

            if (!rows.length) {
                throw new Error("The CSV is empty.");
            }

            years = [...new Set(rows.map(d => d.year))]
                .sort(d3.ascending);

            state.year = years.at(-1);

            fillSelect(elements.year, [...years].reverse());

            const sexCategories = [
                ...new Set(rows.map(d => d.sex))
            ].sort(d3.ascending);

            fillSelect(elements.sex, ["All", ...sexCategories]);

            const remotenessOrder = [
                "Major Cities",
                "Regional",
                "Remote",
                "Unknown remoteness"
            ];

            const remotenessCategories = [
                ...new Set(rows.map(d => d.remoteness))
            ].sort(
                (a, b) =>
                    remotenessOrder.indexOf(a) -
                    remotenessOrder.indexOf(b)
            );

            fillSelect(
                elements.remoteness,
                ["All", ...remotenessCategories]
            );

            elements.year.value = String(state.year);
            elements.sex.value = "All";
            elements.remoteness.value = "All";

            document.querySelectorAll(
                "#national-filters select, #national-filters button"
            ).forEach(element => {
                element.disabled = false;
            });

            document.getElementById("national-filters")
                .addEventListener("submit", event => {
                    event.preventDefault();
                });

            elements.year.addEventListener("change", () => {
                state.year = Number(elements.year.value);
                render();
            });

            elements.sex.addEventListener("change", () => {
                state.sex = elements.sex.value;
                render();
            });

            elements.remoteness.addEventListener("change", () => {
                state.remoteness = elements.remoteness.value;
                render();
            });

            elements.reset.addEventListener("click", () => {
                state.year = years.at(-1);
                state.sex = "All";
                state.remoteness = "All";

                elements.year.value = String(state.year);
                elements.sex.value = "All";
                elements.remoteness.value = "All";

                render();
            });

            render();

            const observer = new ResizeObserver(() => {
                cancelAnimationFrame(resizeFrame);
                resizeFrame = requestAnimationFrame(render);
            });

            document.querySelectorAll(".national-plot")
                .forEach(plot => observer.observe(plot));

        } catch (error) {
            elements.selection.textContent =
                `${error.message} Open with Live Server and check ` +
                "data/national_road_injuries.csv.";

            elements.selection.style.color = "#8b0000";
            console.error(error);
        }
    }

    init();
})();