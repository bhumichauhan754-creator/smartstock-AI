"use strict";

const svgNamespace = "http://www.w3.org/2000/svg";
const chart = document.querySelector("#stockChart");
const periodSelect = document.querySelector("#chartPeriod");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarScrim = document.querySelector("#sidebarScrim");
const notificationButton = document.querySelector("#notificationButton");
const notificationPopover = document.querySelector("#notificationPopover");
const activitySearch = document.querySelector("#activitySearch");
const activityRows = Array.from(document.querySelectorAll("[data-search-item]"));
const emptySearch = document.querySelector("#emptySearch");

const movementData = document.body.dataset.demo === "false"
    ? JSON.parse(document.querySelector("#stockChartData").textContent)
    : {
    6: {
        labels: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
        received: [74, 108, 91, 145, 121, 177],
        dispatched: [58, 76, 69, 108, 88, 125]
    },
    3: {
        labels: ["Sep", "Oct", "Nov"],
        received: [145, 121, 177],
        dispatched: [108, 88, 125]
    }
    };

function createSvgElement(tagName, attributes) {
    const element = document.createElementNS(svgNamespace, tagName);
    Object.entries(attributes).forEach(function ([name, value]) {
        element.setAttribute(name, String(value));
    });
    return element;
}

function appendChartText(parent, text, attributes) {
    const element = createSvgElement("text", attributes);
    element.textContent = text;
    parent.appendChild(element);
}

function drawStockChart(period) {
    const data = movementData[period];
    if (!data) {
        return;
    }

    const width = 700;
    const height = 255;
    const left = 42;
    const right = 12;
    const top = 14;
    const bottom = 31;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const largestValue = Math.max(...data.received, ...data.dispatched, 0);
    const maxValue = Math.max(200, Math.ceil(largestValue / 50) * 50);

    chart.replaceChildren();

    [0, 0.25, 0.5, 0.75, 1].forEach(function (fraction) {
        const value = maxValue * fraction;
        const y = top + chartHeight - (value / maxValue) * chartHeight;
        chart.appendChild(createSvgElement("line", {
            x1: left,
            y1: y,
            x2: width - right,
            y2: y,
            class: "chart-grid-line"
        }));
        appendChartText(chart,         String(Math.round(value)), {
            x: left - 12,
            y: y + 3,
            "text-anchor": "end",
            class: "chart-axis-label"
        });
    });

    const xForIndex = function (index) {
        return left + (data.labels.length === 1 ? chartWidth / 2 : (index * chartWidth) / (data.labels.length - 1));
    };
    const yForValue = function (value) {
        return top + chartHeight - (value / maxValue) * chartHeight;
    };

    data.labels.forEach(function (label, index) {
        appendChartText(chart, label, {
            x: xForIndex(index),
            y: height - 7,
            "text-anchor": "middle",
            class: "chart-month-label"
        });
    });

    [
        { values: data.received, className: "received", color: "#4383dc" },
        { values: data.dispatched, className: "dispatched", color: "#8fc9bd" }
    ].forEach(function (series) {
        const points = series.values.map(function (value, index) {
            return { x: xForIndex(index), y: yForValue(value) };
        });
        const linePath = points.map(function (point, index) {
            return (index === 0 ? "M" : "L") + point.x + " " + point.y;
        }).join(" ");
        const areaPath = linePath + " L " + points[points.length - 1].x + " " + (top + chartHeight) +
            " L " + points[0].x + " " + (top + chartHeight) + " Z";

        chart.appendChild(createSvgElement("path", {
            d: areaPath,
            fill: series.color,
            class: "chart-area"
        }));
        chart.appendChild(createSvgElement("path", {
            d: linePath,
            class: "chart-line " + series.className
        }));
        points.forEach(function (point) {
            chart.appendChild(createSvgElement("circle", {
                cx: point.x,
                cy: point.y,
                r: 4,
                fill: series.color,
                class: "chart-point"
            }));
        });
    });
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function filterActivities() {
    const query = activitySearch.value.trim().toLowerCase();
    let visibleRows = 0;

    activityRows.forEach(function (row) {
        const matches = row.dataset.searchItem.includes(query);
        row.hidden = !matches;
        if (matches) {
            visibleRows += 1;
        }
    });

    emptySearch.hidden = visibleRows > 0;
}

periodSelect.addEventListener("change", function () {
    drawStockChart(periodSelect.value);
});

sidebarToggle.addEventListener("click", function () {
    setSidebarOpen(!sidebar.classList.contains("is-open"));
});

sidebarScrim.addEventListener("click", function () {
    setSidebarOpen(false);
});

sidebar.addEventListener("click", function (event) {
    if (event.target.closest(".nav-link") && window.matchMedia("(max-width: 980px)").matches) {
        setSidebarOpen(false);
    }
});

notificationButton.addEventListener("click", function () {
    const isExpanded = notificationButton.getAttribute("aria-expanded") === "true";
    notificationButton.setAttribute("aria-expanded", String(!isExpanded));
    notificationPopover.hidden = isExpanded;
});

activitySearch.addEventListener("input", filterActivities);

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        setSidebarOpen(false);
        notificationButton.setAttribute("aria-expanded", "false");
        notificationPopover.hidden = true;
    }
});

drawStockChart(periodSelect.value);
