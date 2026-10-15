let chartInstance = null;

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

      setupFilters(data);
      initializeDashboard(data);
      document.getElementById("chart-type-selector").onchange = () =>
        filterAndRenderData(data);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      document.getElementById("data-status").textContent =
        "Failed to load LEGO set data. Run the Python export script and check that the page is being served over HTTP.";
    });
});

function setupFilters(data) {
  const dates = data
    .map((item) => item.released)
    .filter(Boolean)
    .sort();

  flatpickr("#start-date", {
    defaultDate: dates[0],
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "F j, Y",
    onChange: () => filterAndRenderData(data),
  });

  flatpickr("#end-date", {
    defaultDate: dates[dates.length - 1],
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "F j, Y",
    onChange: () => filterAndRenderData(data),
  });

  document.getElementById("category-filter").onchange = () =>
    filterAndRenderData(data);
}

function initializeDashboard(data) {
  populateCategoryFilter(data);
  filterAndRenderData(data);
}

function filterAndRenderData(data) {
  const chartType = document.getElementById("chart-type-selector").value;
  const startDate = getSelectedDate("start-date");
  const endDate = getSelectedDate("end-date");
  const selectedTheme = document.getElementById("category-filter").value;

  const filteredData = data
    .filter(
      (item) =>
        item.released >= startDate &&
        item.released <= endDate &&
        (selectedTheme === "all" || item.theme_l1 === selectedTheme),
    )
    .sort(
      (a, b) =>
        a.released.localeCompare(b.released) ||
        a.set_number.localeCompare(b.set_number),
    );

  updateKeyMetrics(filteredData);
  drawChart(filteredData, "chart-canvas", chartType);
  populateDataTable(filteredData);
}

function getSelectedDate(elementId) {
  const picker = document.getElementById(elementId)._flatpickr;
  const date = picker.selectedDates[0];
  return date ? picker.formatDate(date, "Y-m-d") : "";
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

  const annualMedian = (values) => {
    const sortedValues = values.sort((a, b) => a - b);
    const middle = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2
      ? sortedValues[middle]
      : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
  };
  const yearlyMedians = new Map(
    [...yearlyValues].map(([year, values]) => [
      `${year}-01-01`,
      annualMedian(values),
    ]),
  );
  const dates = [...new Set([...releases.keys(), ...yearlyMedians.keys()])].sort();

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
          borderColor: "rgb(75, 135, 192)",
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
