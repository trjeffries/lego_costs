let chartInstance = null;
let themeScatterInstance = null;
let subThemeScatterInstance = null;
let selectedThemeForSubTheme = null;
let selectedThemeForTable = null;
let selectedSubThemeForTable = null;
const chartColor = "rgb(75, 135, 192)";
const themeColors = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc949",
  "#af7aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ab",
  "#499894",
  "#d37295",
  "#b07aa1",
  "#86bc86",
  "#d4a6c8",
  "#79706e",
];

const pricePerMetrics = {
  ppbm_us: "Pieces per Big Mac (US)",
  ppbm_gb: "Pieces per Big Mac (UK)",
  ppbm_eu: "Pieces per Big Mac (EU)",
  ppsp: "Pieces per S&P 500",
  ppp: "Pieces per Pound",
  ppd: "Pieces per Dollar",
  ppe: "Pieces per Euro",
};

document.addEventListener("DOMContentLoaded", function () {
  fetch("../assets/full_output.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Data request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!data || data.length === 0) {
        document.getElementById("data-status").textContent =
          "No LEGO set data is available.";
        return;
      }

      initializeDashboard(data);
      document
        .getElementById("close-sub-theme-chart")
        .addEventListener("click", () => closeSubThemeChart(data));
      document
        .getElementById("clear-scatter-selection")
        .addEventListener("click", () => {
          selectedThemeForTable = null;
          closeSubThemeChart(data);
        });
      document.getElementById("chart-type-selector").onchange = () =>
        filterAndRenderData(data);
      document.getElementById("category-filter").onchange = () => {
        populateSubThemeFilter(data);
        filterAndRenderData(data);
      };
      document.getElementById("sub-theme-filter").onchange = () =>
        filterAndRenderData(data);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      document.getElementById("data-status").textContent =
        "Failed to load LEGO set data. Run the Python export script and check that the page is being served over HTTP.";
    });
});

function initializeDashboard(data) {
  populateCategoryFilter(data);
  populateSubThemeFilter(data);
  filterAndRenderData(data);
  drawThemeScatter(data);
  renderScatterFilteredTable(data);
}

function filterAndRenderData(data) {
  const chartType = document.getElementById("chart-type-selector").value;
  const selectedTheme = document.getElementById("category-filter").value;
  const selectedSubTheme = document.getElementById("sub-theme-filter").value;

  const filteredData = data
    .filter(
      (item) =>
        (selectedTheme === "all" || item.theme_l1 === selectedTheme) &&
        (selectedSubTheme === "all" || item.theme_l2 === selectedSubTheme),
    )
    .sort(
      (a, b) =>
        a.released.localeCompare(b.released) ||
        a.set_number.localeCompare(b.set_number),
    );

  updateKeyMetrics(filteredData);
  drawChart(filteredData, "chart-canvas", chartType);
}

function median(values) {
  const sortedValues = values.sort((a, b) => a - b);
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function averageFor(data, field) {
  const values = data
    .map((item) => item[field])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);

  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function updateKeyMetrics(data) {
  document.getElementById("sets-released").textContent =
    data.length.toLocaleString();
  document.getElementById("average-pieces-per-us-big-mac").textContent =
    averageFor(data, "ppbm_us").toFixed(1);
  document.getElementById("average-pieces-per-pound").textContent = averageFor(
    data,
    "ppp",
  ).toFixed(1);
}

function drawChart(data, elementId, metric) {
  const ctx = document.getElementById(elementId).getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  const releases = new Map();
  const yearlyValues = new Map();
  data.forEach((item) => {
    const rawValue = item[metric];
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return;
    }

    const release = releases.get(item.released) || { total: 0, count: 0 };
    release.total += value;
    release.count += 1;
    releases.set(item.released, release);

    const year = item.released.slice(0, 4);
    const yearValues = yearlyValues.get(year) || [];
    yearValues.push(value);
    yearlyValues.set(year, yearValues);
  });

  const yearlyMedians = new Map(
    [...yearlyValues].map(([year, values]) => [
      `${year}-01-01`,
      median(values),
    ]),
  );
  const dates = [
    ...new Set([...releases.keys(), ...yearlyMedians.keys()]),
  ].sort();

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: `${pricePerMetrics[metric]} by release date`,
          data: dates.map((date) => {
            const release = releases.get(date);
            return release ? release.total / release.count : null;
          }),
          fill: false,
          borderColor: "rgba(75, 135, 192, 0.3)",
          backgroundColor: "rgba(75, 135, 192, 0.1)",
          tension: 0.1,
          spanGaps: false,
        },
        {
          label: `${pricePerMetrics[metric]} annual median`,
          data: dates.map((date) => yearlyMedians.get(date) ?? null),
          fill: false,
          borderColor: chartColor,
          backgroundColor: "rgba(75, 135, 192, 0.2)",
          tension: 0.1,
          spanGaps: true,
        },
      ],
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: "Release date" },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: pricePerMetrics[metric] },
        },
      },
    },
  });
}

function drawThemeScatter(data) {
  const ctx = document
    .getElementById("theme-scatter-canvas")
    .getContext("2d");

  if (themeScatterInstance) {
    themeScatterInstance.destroy();
  }

  const themes = new Map();
  data.forEach((item) => {
    if (!item.theme_l1) {
      return;
    }

    const theme = themes.get(item.theme_l1) || {
      count: 0,
      pieces: [],
      ukPrices: [],
    };
    theme.count += 1;

    const pieces = Number(item.pieces);
    if (item.pieces !== null && item.pieces !== "" && Number.isFinite(pieces)) {
      theme.pieces.push(pieces);
    }

    const ukPrice = Number(item.retail_gbp);
    if (
      item.retail_gbp !== null &&
      item.retail_gbp !== "" &&
      Number.isFinite(ukPrice)
    ) {
      theme.ukPrices.push(ukPrice);
    }

    themes.set(item.theme_l1, theme);
  });

  const datasets = [...themes.entries()]
    .filter(([, theme]) => theme.pieces.length && theme.ukPrices.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, theme], index) => {
      const color = themeColors[index % themeColors.length];
      return {
        label: name,
        data: [
          {
            x: median(theme.ukPrices),
            y: median(theme.pieces),
            r: 4 + (Math.sqrt(theme.count) / Math.sqrt(data.length)) * 18,
            theme: name,
            setCount: theme.count,
          },
        ],
        backgroundColor: color,
        borderColor: "#000000",
        borderWidth: 1,
      };
    });

  themeScatterInstance = new Chart(ctx, {
    type: "bubble",
    data: {
      datasets,
    },
    options: {
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Median UK price (£)" },
          ticks: {
            callback: (value) =>
              new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
                maximumFractionDigits: 0,
              }).format(value),
          },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Median number of pieces" },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw;
              const price = new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(point.x);
              return `Theme Group: ${point.theme}, ${point.setCount.toLocaleString()} sets, median ${price}, ${point.y.toLocaleString()} pieces`;
            },
          },
        },
      },
      onClick: (event, elements, chart) => {
        if (!elements.length) {
          return;
        }

        const theme = chart.data.datasets[elements[0].datasetIndex].label;
        selectedThemeForTable = theme;
        selectedSubThemeForTable = null;
        renderScatterFilteredTable(data);
        if (theme === selectedThemeForSubTheme) {
          closeSubThemeChart(data);
        } else {
          drawSubThemeScatter(data, theme);
        }
      },
    },
  });
}

function closeSubThemeChart(data) {
  document.getElementById("sub-theme-chart-section").hidden = true;
  selectedThemeForSubTheme = null;
  selectedSubThemeForTable = null;
  renderScatterFilteredTable(data);
  if (subThemeScatterInstance) {
    subThemeScatterInstance.destroy();
    subThemeScatterInstance = null;
  }
}

function drawSubThemeScatter(data, parentTheme) {
  const section = document.getElementById("sub-theme-chart-section");
  const chartContainer = document.getElementById("sub-theme-chart-container");
  const canvas = document.getElementById("sub-theme-scatter-canvas");
  const ctx = canvas.getContext("2d");

  if (subThemeScatterInstance) {
    subThemeScatterInstance.destroy();
  }

  const parentData = data.filter(
    (item) => item.theme_l1 === parentTheme && item.theme_l2,
  );
  const subThemes = new Map();
  parentData.forEach((item) => {
    const subTheme = subThemes.get(item.theme_l2) || {
      count: 0,
      pieces: [],
      ukPrices: [],
    };
    subTheme.count += 1;

    const pieces = Number(item.pieces);
    if (item.pieces !== null && item.pieces !== "" && Number.isFinite(pieces)) {
      subTheme.pieces.push(pieces);
    }

    const ukPrice = Number(item.retail_gbp);
    if (
      item.retail_gbp !== null &&
      item.retail_gbp !== "" &&
      Number.isFinite(ukPrice)
    ) {
      subTheme.ukPrices.push(ukPrice);
    }

    subThemes.set(item.theme_l2, subTheme);
  });

  const datasets = [...subThemes.entries()]
    .filter(([, subTheme]) => subTheme.pieces.length && subTheme.ukPrices.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, subTheme], index) => {
      const color = themeColors[index % themeColors.length];
      return {
        label: name,
        data: [
          {
            x: median(subTheme.ukPrices),
            y: median(subTheme.pieces),
            r:
              4 +
              (Math.sqrt(subTheme.count) / Math.sqrt(parentData.length)) * 18,
            subTheme: name,
            setCount: subTheme.count,
          },
        ],
        backgroundColor: color,
        borderColor: "#000000",
        borderWidth: 1,
      };
    });

  document.getElementById(
    "sub-theme-chart-heading",
  ).textContent = `Typical Set Size and UK Price by Theme: ${parentTheme}`;
  chartContainer.style.height = `${Math.max(440, datasets.length * 24)}px`;
  section.hidden = false;
  selectedThemeForSubTheme = parentTheme;

  subThemeScatterInstance = new Chart(ctx, {
    type: "bubble",
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Median UK price (£)" },
          ticks: {
            callback: (value) =>
              new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
                maximumFractionDigits: 0,
              }).format(value),
          },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Median number of pieces" },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw;
              const price = new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(point.x);
              return `Theme: ${point.subTheme}, ${point.setCount.toLocaleString()} sets, median ${price}, ${point.y.toLocaleString()} pieces`;
            },
          },
        },
      },
      onClick: (event, elements, chart) => {
        if (!elements.length) {
          return;
        }

        const subTheme =
          chart.data.datasets[elements[0].datasetIndex].label;
        selectedSubThemeForTable =
          selectedSubThemeForTable === subTheme ? null : subTheme;
        renderScatterFilteredTable(data);
      },
    },
  });
}

function renderScatterFilteredTable(data) {
  const filteredData = data
    .filter(
      (item) =>
        (!selectedThemeForTable ||
          item.theme_l1 === selectedThemeForTable) &&
        (!selectedSubThemeForTable ||
          item.theme_l2 === selectedSubThemeForTable),
    )
    .sort(
      (a, b) =>
        a.released.localeCompare(b.released) ||
        a.set_number.localeCompare(b.set_number),
    );

  const heading = document.getElementById("raw-data-heading");
  const selection = [selectedThemeForTable, selectedSubThemeForTable]
    .filter(Boolean)
    .join(" / ");
  heading.textContent = selection
    ? `Raw Data — Theme Group: ${selectedThemeForTable}${
        selectedSubThemeForTable ? ` / Theme: ${selectedSubThemeForTable}` : ""
      }`
    : "Raw Data";
  document.getElementById("clear-scatter-selection").hidden = !selection;
  populateDataTable(filteredData, {
    hideThemeGroup: Boolean(selectedThemeForTable),
    hideTheme: Boolean(selectedSubThemeForTable),
  });
}

function formatCurrency(value, currency) {
  if (value == null || value === "") {
    return "—";
  }

  const formattedValue = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
  return currency === "USD" ? formattedValue.replace("US$", "$") : formattedValue;
}

function measureColumnWidth(tableElement, texts) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const tableStyle = getComputedStyle(tableElement);
  context.font = tableStyle.font;

  const widestText = Math.max(
    ...texts.map((text) => context.measureText(String(text ?? "")).width),
  );
  return `${Math.ceil(widestText + 24)}px`;
}

function populateDataTable(data, { hideThemeGroup, hideTheme }) {
  const tableElement = $("#data-table");
  const table = tableElement[0];
  const headers = [
    "Set Number",
    "Set Name",
    "Theme Group",
    "Theme",
    "Sub-Theme",
    "Pieces",
    "UK Cost",
    "US Cost",
    "EU Cost",
  ];
  const shortColumnWidths = new Map([
    [0, measureColumnWidth(table, [headers[0]])],
    [5, measureColumnWidth(table, [headers[5]])],
    [6, measureColumnWidth(table, [headers[6]])],
    [7, measureColumnWidth(table, [headers[7]])],
    [8, measureColumnWidth(table, [headers[8]])],
  ]);
  let themeGroupWidth = measureColumnWidth(table, [
    headers[2],
    ...data.map((item) => item.theme_l1),
  ]);
  let themeWidth = measureColumnWidth(table, [
    headers[3],
    ...data.map((item) => item.theme_l2),
  ]);
  let subThemeWidth = measureColumnWidth(table, [
    headers[4],
    ...data.map((item) => item.theme_l3),
  ]);
  const maxThemeColumnWidth = 160;
  themeGroupWidth = `${Math.min(
    parseFloat(themeGroupWidth),
    maxThemeColumnWidth,
  )}px`;
  themeWidth = `${Math.min(parseFloat(themeWidth), maxThemeColumnWidth)}px`;
  subThemeWidth = `${Math.min(
    parseFloat(subThemeWidth),
    maxThemeColumnWidth,
  )}px`;
  const tableContainerWidth = table.closest("#raw-data").clientWidth;
  const compactColumnWidth = [...shortColumnWidths.values()].reduce(
    (total, width) => total + parseFloat(width),
    0,
  );
  const availableThemeColumnWidth = Math.max(
    0,
    tableContainerWidth - compactColumnWidth - 240 - 8,
  );
  const visibleThemeColumnWidths = [
    ...(hideThemeGroup ? [] : [themeGroupWidth]),
    ...(hideTheme ? [] : [themeWidth]),
    subThemeWidth,
  ];
  const visibleThemeColumnWidth = visibleThemeColumnWidths.reduce(
    (total, width) => total + parseFloat(width),
    0,
  );
  if (visibleThemeColumnWidth > availableThemeColumnWidth) {
    const widthScale = availableThemeColumnWidth / visibleThemeColumnWidth;
    themeGroupWidth = `${Math.floor(parseFloat(themeGroupWidth) * widthScale)}px`;
    themeWidth = `${Math.floor(parseFloat(themeWidth) * widthScale)}px`;
    subThemeWidth = `${Math.floor(parseFloat(subThemeWidth) * widthScale)}px`;
  }
  const fixedColumnWidths = [
    ...shortColumnWidths.values(),
    subThemeWidth,
    ...(hideThemeGroup ? [] : [themeGroupWidth]),
    ...(hideTheme ? [] : [themeWidth]),
  ];
  const setNameWidth = `${Math.max(
    240,
    tableContainerWidth -
      fixedColumnWidths.reduce((total, width) => total + parseFloat(width), 0) -
      2,
  )}px`;
  const columnWidths = [
    shortColumnWidths.get(0),
    setNameWidth,
    themeGroupWidth,
    themeWidth,
    subThemeWidth,
    shortColumnWidths.get(5),
    shortColumnWidths.get(6),
    shortColumnWidths.get(7),
    shortColumnWidths.get(8),
  ];

  if ($.fn.DataTable.isDataTable(tableElement)) {
    tableElement.DataTable().clear().destroy();
  }

  table.style.removeProperty("width");
  table.style.removeProperty("table-layout");
  table.querySelectorAll("thead th").forEach((header) => {
    header.removeAttribute("style");
  });
  table.querySelectorAll("colgroup").forEach((colgroup) => colgroup.remove());
  const colgroup = document.createElement("colgroup");
  columnWidths.forEach((width, index) => {
    const column = document.createElement("col");
    column.style.width = width;
    if ((index === 2 && hideThemeGroup) || (index === 3 && hideTheme)) {
      column.style.display = "none";
    }
    colgroup.appendChild(column);
  });
  table.insertBefore(colgroup, table.firstChild);

  tableElement.DataTable({
    data: data.map((item) => [
      item.set_number,
      item.set_name,
      item.theme_l1,
      item.theme_l2,
      item.theme_l3 || "—",
      item.pieces,
      formatCurrency(item.retail_gbp, "GBP"),
      formatCurrency(item.retail_usd, "USD"),
      formatCurrency(item.retail_eur, "EUR"),
    ]),
    columns: [
      {
        title: headers[0],
        width: columnWidths[0],
        className: "raw-data-compact",
      },
      {
        title: headers[1],
        width: columnWidths[1],
        className: "raw-data-set-name",
      },
      {
        title: headers[2],
        width: columnWidths[2],
        className: "raw-data-theme",
        visible: !hideThemeGroup,
      },
      {
        title: headers[3],
        width: columnWidths[3],
        className: "raw-data-theme",
        visible: !hideTheme,
      },
      {
        title: headers[4],
        width: columnWidths[4],
        className: "raw-data-theme",
      },
      {
        title: headers[5],
        width: columnWidths[5],
        className: "raw-data-compact",
      },
      {
        title: headers[6],
        width: columnWidths[6],
        className: "raw-data-compact",
      },
      {
        title: headers[7],
        width: columnWidths[7],
        className: "raw-data-compact",
      },
      {
        title: headers[8],
        width: columnWidths[8],
        className: "raw-data-compact",
      },
    ],
    autoWidth: false,
    scrollX: true,
    order: [],
  });

  const tableWidth = columnWidths.reduce((total, width, index) => {
    if ((index === 2 && hideThemeGroup) || (index === 3 && hideTheme)) {
      return total;
    }
    return total + parseFloat(width);
  }, 0);
  const tableWrapper = table.closest(".dataTables_wrapper");
  const headerTable = tableWrapper.querySelector(".dataTables_scrollHead table");
  const headerColgroup = colgroup.cloneNode(true);
  headerTable.querySelectorAll("colgroup").forEach((existingColgroup) => {
    existingColgroup.remove();
  });
  headerTable.insertBefore(headerColgroup, headerTable.firstChild);
  tableWrapper
    .querySelectorAll(".dataTables_scrollHead table, .dataTables_scrollBody table")
    .forEach((scrollTable) => {
      scrollTable.style.setProperty("width", `${tableWidth}px`, "important");
      scrollTable.style.setProperty("table-layout", "fixed", "important");
    });
  tableWrapper.querySelector(".dataTables_scrollHeadInner").style.width =
    `${tableWidth}px`;
}

function populateCategoryFilter(data) {
  const categoryFilter = document.getElementById("category-filter");
  categoryFilter.innerHTML = "";
  categoryFilter.appendChild(
    new Option("All Theme Groups", "all", true, true),
  );

  const themes = [
    ...new Set(data.map((item) => item.theme_l1).filter((theme) => theme)),
  ].sort((a, b) => a.localeCompare(b));
  themes.forEach((theme) => {
    categoryFilter.appendChild(new Option(theme, theme));
  });
}

function populateSubThemeFilter(data) {
  const categoryFilter = document.getElementById("category-filter");
  const subThemeFilter = document.getElementById("sub-theme-filter");
  const selectedTheme = categoryFilter.value;
  const subThemes = [
    ...new Set(
      data
        .filter(
          (item) => selectedTheme === "all" || item.theme_l1 === selectedTheme,
        )
        .map((item) => item.theme_l2)
        .filter((subTheme) => subTheme),
    ),
  ].sort((a, b) => a.localeCompare(b));

  subThemeFilter.innerHTML = "";
  subThemeFilter.appendChild(
    new Option("All Themes", "all", true, true),
  );
  subThemes.forEach((subTheme) => {
    subThemeFilter.appendChild(new Option(subTheme, subTheme));
  });
}
