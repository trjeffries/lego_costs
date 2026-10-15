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
  fetch("assets/full_output.json")
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
              return `${point.theme}: ${point.setCount.toLocaleString()} sets, median ${price}, ${point.y.toLocaleString()} pieces`;
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
  ).textContent = `Typical Set Size and UK Price by Sub-Theme: ${parentTheme}`;
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
              return `${point.subTheme}: ${point.setCount.toLocaleString()} sets, median ${price}, ${point.y.toLocaleString()} pieces`;
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
  heading.textContent = selection ? `Raw Data — ${selection}` : "Raw Data";
  document.getElementById("clear-scatter-selection").hidden = !selection;
  populateDataTable(filteredData);
}

function populateDataTable(data) {
  const tableElement = $("#data-table");

  if ($.fn.DataTable.isDataTable(tableElement)) {
    tableElement.DataTable().clear().destroy();
  }

  tableElement.DataTable({
    data: data.map((item) => [
      item.set_number,
      item.set_name,
      item.theme_l1,
      item.theme_l2,
      item.pieces,
      item.retail_gbp == null
        ? "—"
        : new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(item.retail_gbp),
    ]),
    columns: [
      { title: "Set Number" },
      { title: "Set Name" },
      { title: "Theme" },
      { title: "Sub-theme" },
      { title: "Pieces" },
      { title: "UK Cost" },
    ],
  });
}

function populateCategoryFilter(data) {
  const categoryFilter = document.getElementById("category-filter");
  categoryFilter.innerHTML = "";
  categoryFilter.appendChild(new Option("All Themes", "all", true, true));

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
    new Option("All Sub-Themes", "all", true, true),
  );
  subThemes.forEach((subTheme) => {
    subThemeFilter.appendChild(new Option(subTheme, subTheme));
  });
}
