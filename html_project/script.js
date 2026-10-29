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
const rawColumns = [
  { key: "set_number", title: "Set Number", className: "raw-data-compact" },
  { key: "set_name", title: "Set Name", className: "raw-data-set-name" },
  { key: "theme_l1", title: "Theme Group", className: "raw-data-theme" },
  { key: "theme_l2", title: "Theme", className: "raw-data-theme" },
  {
    key: "theme_l3",
    title: "Sub-Theme",
    className: "raw-data-theme",
    format: (value) => value || "—",
  },
  { key: "pieces", title: "Pieces", className: "raw-data-compact" },
  {
    key: "retail_gbp",
    title: "UK Cost",
    className: "raw-data-compact",
    currency: "GBP",
  },
  {
    key: "retail_usd",
    title: "US Cost",
    className: "raw-data-compact",
    currency: "USD",
  },
  {
    key: "retail_eur",
    title: "EU Cost",
    className: "raw-data-compact",
    currency: "EUR",
  },
];

let allSetData = [];
let annualBigMacData = [];
let adventCalendarData = [];
let tableRows = [];
let selectedThemeForSubTheme = null;
let selectedThemeForTable = null;
let selectedSubThemeForTable = null;
let tablePage = 0;
let tableSort = { key: "released", direction: "asc" };
let resizeTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [setsResponse, bigMacResponse] = await Promise.all([
      fetch("assets/full_output.json", { cache: "no-cache" }),
      fetch("assets/big_mac_gbp_annual.json", { cache: "no-cache" }),
    ]);
    if (!setsResponse.ok || !bigMacResponse.ok) {
      throw new Error("A dashboard data request failed");
    }
    [allSetData, annualBigMacData] = await Promise.all([
      setsResponse.json(),
      bigMacResponse.json(),
    ]);
    if (!Array.isArray(allSetData) || allSetData.length === 0 || !Array.isArray(annualBigMacData)) {
      document.getElementById("data-status").textContent =
        "No LEGO set data is available.";
      return;
    }
    initializeDashboard();
  } catch (error) {
    console.error("Error loading LEGO set data:", error);
    document.getElementById("data-status").textContent =
      "Failed to load LEGO set data. Run the Python export script and check that the page is being served over HTTP.";
  }
});

function initializeDashboard() {
  initializeAdventCalendars();
  populateCategoryFilter();
  populateSubThemeFilter();
  initializeYearFilter();
  initializeReasonTabs();
  document
    .getElementById("chart-type-selector")
    .addEventListener("change", updateFilteredDashboard);
  document.getElementById("category-filter").addEventListener("change", () => {
    populateSubThemeFilter();
    updateFilteredDashboard();
  });
  document
    .getElementById("sub-theme-filter")
    .addEventListener("change", updateFilteredDashboard);
  document
    .getElementById("close-sub-theme-chart")
    .addEventListener("click", closeSubThemeChart);
  document
    .getElementById("clear-scatter-selection")
    .addEventListener("click", () => {
      selectedThemeForTable = null;
      closeSubThemeChart();
    });
  document.getElementById("table-page-size").addEventListener("change", () => {
    tablePage = 0;
    renderRawTable();
  });
  document.getElementById("table-search").addEventListener("input", () => {
    tablePage = 0;
    renderRawTable();
  });
  document.getElementById("table-previous").addEventListener("click", () => {
    tablePage = Math.max(0, tablePage - 1);
    renderRawTable();
  });
  document.getElementById("table-next").addEventListener("click", () => {
    tablePage += 1;
    renderRawTable();
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(redrawCharts, 100);
  });
  updateFilteredDashboard();
  drawTopFivePriceChart(allSetData, annualBigMacData);
  drawThemeScatter();
  renderScatterFilteredTable();
}

function initializeReasonTabs() {
  const tabs = [...document.querySelectorAll('.question-grid [role="tab"]')];
  const showPanel = (selectedTab) => {
    if (selectedTab.getAttribute("aria-selected") === "true") {
      return;
    }
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
    });
    if (selectedTab.id === "top-end-tab") {
      drawTopFivePriceChart(allSetData, annualBigMacData);
    } else if (selectedTab.id === "star-wars-tab") {
      drawStarWarsValueChart(allSetData);
      drawAnnualTopFivePriceChart(allSetData);
    } else if (selectedTab.id === "advent-calendar-tab") {
      drawAdventCalendarChart();
    } else if (selectedTab.id === "high-cost-tab") {
      drawHighCostChart(allSetData);
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showPanel(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      tabs[nextIndex].focus();
      showPanel(tabs[nextIndex]);
    });
  });
}

function populateCategoryFilter() {
  const select = document.getElementById("category-filter");
  const groups = [
    ...new Set(allSetData.map((item) => item.theme_l1).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  select.replaceChildren(new Option("All Theme Groups", "all"));
  groups.forEach((themeGroup) =>
    select.add(new Option(themeGroup, themeGroup)),
  );
}

function populateSubThemeFilter() {
  const themeGroup = document.getElementById("category-filter").value;
  const select = document.getElementById("sub-theme-filter");
  const themes = [
    ...new Set(
      allSetData
        .filter((item) => themeGroup === "all" || item.theme_l1 === themeGroup)
        .map((item) => item.theme_l2)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const currentValue = select.value;
  select.replaceChildren(new Option("All Themes", "all"));
  themes.forEach((theme) => select.add(new Option(theme, theme)));
  select.value = themes.includes(currentValue) ? currentValue : "all";
}

function initializeYearFilter() {
  const years = allSetData
    .map((item) => item.year_released)
    .filter(Number.isInteger);
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const startInput = document.getElementById("year-start");
  const endInput = document.getElementById("year-end");
  const track = document.getElementById("year-range-track");
  const filter = document.getElementById("year-filter");

  for (const input of [startInput, endInput]) {
    input.setAttribute("aria-valuemin", firstYear);
    input.setAttribute("aria-valuemax", lastYear);
  }
  startInput.value = firstYear;
  endInput.value = lastYear;
  document.getElementById("year-min-label").textContent = firstYear;
  document.getElementById("year-max-label").textContent = lastYear;

  function updateRange(redraw = true) {
    const start = Number(startInput.value);
    const end = Number(endInput.value);
    document.getElementById("year-start-value").value = start;
    document.getElementById("year-end-value").value = end;
    document.getElementById("year-filter-value").textContent = `${start}–${end}`;
    startInput.setAttribute("aria-valuenow", start);
    endInput.setAttribute("aria-valuenow", end);
    const position = (year) => `${((year - firstYear) / (lastYear - firstYear || 1)) * 100}%`;
    startInput.style.setProperty("--position", position(start));
    endInput.style.setProperty("--position", position(end));
    track.style.setProperty("--start-position", position(start));
    track.style.setProperty("--end-position", position(end));
    if (redraw) updateFilteredDashboard();
  }

  function setYear(input, year) {
    const lower = input === startInput ? firstYear : Number(startInput.value);
    const upper = input === startInput ? Number(endInput.value) : lastYear;
    const next = Math.max(lower, Math.min(upper, year));
    if (Number(input.value) === next) return;
    input.value = next;
    updateRange();
  }

  function yearAt(pointerX) {
    const bounds = track.getBoundingClientRect();
    return firstYear + Math.round(((pointerX - bounds.left) / bounds.width) * (lastYear - firstYear));
  }

  let activeInput = null;
  let grabOffset = 0;
  track.addEventListener("pointerdown", (event) => {
    const clickedThumb = event.target.closest(".year-range-thumb");
    const year = yearAt(event.clientX);
    activeInput = clickedThumb || (Math.abs(year - Number(startInput.value)) <= Math.abs(year - Number(endInput.value)) ? startInput : endInput);
    grabOffset = clickedThumb ? event.clientX - clickedThumb.getBoundingClientRect()[clickedThumb === startInput ? "right" : "left"] : 0;
    activeInput.focus({ preventScroll: true });
    track.setPointerCapture(event.pointerId);
    if (!clickedThumb) setYear(activeInput, year);
    event.preventDefault();
  });
  track.addEventListener("pointermove", (event) => {
    if (activeInput && track.hasPointerCapture(event.pointerId)) setYear(activeInput, yearAt(event.clientX - grabOffset));
  });
  track.addEventListener("pointerup", () => { activeInput = null; });
  track.addEventListener("pointercancel", () => { activeInput = null; });
  for (const input of [startInput, endInput]) {
    input.addEventListener("keydown", (event) => {
      const year = Number(input.value);
      const change = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }[event.key];
      if (change === undefined && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      setYear(input, event.key === "Home" ? firstYear : event.key === "End" ? lastYear : year + change);
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!filter.contains(event.target)) filter.open = false;
  });
  filter.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      filter.open = false;
      filter.querySelector("summary").focus();
    }
  });
  updateRange(false);
}

function getDropdownFilteredData() {
  const themeGroup = document.getElementById("category-filter").value;
  const theme = document.getElementById("sub-theme-filter").value;
  const startYear = Number(document.getElementById("year-start").value);
  const endYear = Number(document.getElementById("year-end").value);
  return allSetData
    .filter(
      (item) =>
        (themeGroup === "all" || item.theme_l1 === themeGroup) &&
        (theme === "all" || item.theme_l2 === theme) &&
        item.year_released >= startYear &&
        item.year_released <= endYear,
    )
    .sort(
      (a, b) =>
        a.released.localeCompare(b.released) ||
        a.set_number.localeCompare(b.set_number),
    );
}

function averageFor(data, field) {
  const values = data
    .map((item) => Number(item[field]))
    .filter((value, index) => {
      const raw = data[index][field];
      return raw !== null && raw !== "" && Number.isFinite(value);
    });
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function updateFilteredDashboard() {
  const data = getDropdownFilteredData();
  const metric = document.getElementById("chart-type-selector").value;
  const formatAverage = (value) =>
    value.toLocaleString("en-GB", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  document.getElementById("sets-released").textContent = data.length.toLocaleString();
  document.getElementById("average-pieces-per-set").textContent = formatAverage(
    averageFor(data, "pieces"),
  );
  document.getElementById("selected-metric-label").textContent = pricePerMetrics[metric];
  document.getElementById("average-selected-metric").textContent = formatAverage(
    averageFor(data, metric),
  );
  drawLineChart(data, metric);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function numericValues(data, field) {
  return data
    .map((item) => Number(item[field]))
    .filter((value, index) => {
      const raw = data[index][field];
      return raw !== null && raw !== "" && Number.isFinite(value);
    });
}

function drawLineChart(data, metric) {
  const container = d3.select("#line-chart");
  const width = container.node().clientWidth;
  const height = 440;
  const margin = { top: 25, right: 24, bottom: 70, left: 82 };
  const innerWidth = Math.max(1, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const releases = d3.rollups(
    data.filter(
      (item) =>
        Number.isFinite(Number(item[metric])) &&
        item[metric] !== null &&
        item[metric] !== "",
    ),
    (items) => d3.mean(items, (item) => Number(item[metric])),
    (item) => item.released,
  );
  const releaseData = releases
    .map(([date, value]) => ({ date: parseDate(date), value }))
    .filter((item) => item.date && Number.isFinite(item.value))
    .sort((a, b) => a.date - b.date);
  const annualValues = d3.group(
    data.filter(
      (item) =>
        Number.isFinite(Number(item[metric])) &&
        item[metric] !== null &&
        item[metric] !== "",
    ),
    (item) => item.released.slice(0, 4),
  );
  const annualData = [...annualValues]
    .map(([year, items]) => ({
      date: new Date(Number(year), 0, 1),
      value: median(items.map((item) => Number(item[metric]))),
    }))
    .sort((a, b) => a.date - b.date);
  const dates = [...releaseData, ...annualData].map((item) => item.date);
  const firstDate = d3.min(dates);
  const lastDate = d3.max(dates);
  const yearSpan = firstDate && lastDate ? lastDate.getFullYear() - firstDate.getFullYear() : 0;
  const showMonths = yearSpan <= 1;
  const x = d3
    .scaleTime()
    .domain(d3.extent(dates.length ? dates : [new Date(2000, 0, 1)]))
    .range([0, innerWidth]);
  const maxValue =
    d3.max([...releaseData, ...annualData], (item) => item.value) || 1;
  const y = d3
    .scaleLinear()
    .domain([0, maxValue * 1.05])
    .nice()
    .range([innerHeight, 0]);
  const svg = container
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-label", `${pricePerMetrics[metric]} over release date`);
  const plot = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  plot
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));
  plot
    .append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("~s")));
  plot
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(showMonths
          ? Math.max(2, Math.floor(innerWidth / 100))
          : d3.timeYear.every(Math.max(1, Math.ceil(yearSpan / Math.max(2, Math.floor(innerWidth / 100))))))
        .tickFormat(d3.timeFormat(showMonths ? "%b %Y" : "%Y")),
    );
  plot
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .text("Release date");
  plot
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -60)
    .text(pricePerMetrics[metric]);

  const line = d3
    .line()
    .x((item) => x(item.date))
    .y((item) => y(item.value));
  plot
    .append("path")
    .datum(releaseData)
    .attr("class", "line-release")
    .attr("d", line);
  plot
    .append("path")
    .datum(annualData)
    .attr("class", "line-annual")
    .attr("d", line);
  plot
    .selectAll(".release-point")
    .data(releaseData)
    .join("circle")
    .attr("class", "release-point")
    .attr("cx", (item) => x(item.date))
    .attr("cy", (item) => y(item.value))
    .attr("r", 2.5)
    .attr("fill", "rgba(75, 135, 192, 0.45)")
    .on("mouseenter", (event, item) =>
      showTooltip(
        event,
        `${d3.timeFormat("%Y-%m-%d")(item.date)}: ${item.value.toLocaleString()}`,
      ),
    )
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
  plot
    .selectAll(".annual-point")
    .data(annualData)
    .join("circle")
    .attr("class", "annual-point")
    .attr("cx", (item) => x(item.date))
    .attr("cy", (item) => y(item.value))
    .attr("r", 4)
    .attr("fill", chartColor)
    .on("mouseenter", (event, item) =>
      showTooltip(
        event,
        `${item.date.getFullYear()} annual median: ${item.value.toLocaleString()}`,
      ),
    )
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
  const legend = svg
    .append("g")
    .attr("class", "chart-legend")
    .attr("transform", `translate(${margin.left + 8},${margin.top + 4})`);
  [
    {
      label: `${pricePerMetrics[metric]} by release date`,
      color: "rgba(75, 135, 192, 0.35)",
    },
    { label: `${pricePerMetrics[metric]} annual median`, color: chartColor },
  ].forEach((entry, index) => {
    const row = legend
      .append("g")
      .attr("transform", `translate(0,${index * 20})`);
    row
      .append("line")
      .attr("x2", 24)
      .attr("y1", 5)
      .attr("y2", 5)
      .attr("stroke", entry.color)
      .attr("stroke-width", 2.5);
    row.append("text").attr("x", 31).attr("y", 9).text(entry.label);
  });
}

function buildTopFiveAnnualPrices(data) {
  const pricesByYear = new Map();
  data.forEach((item) => {
    const year = Number(item.year_released);
    const price = Number(item.retail_gbp);
    if (
      !Number.isInteger(year) ||
      item.retail_gbp === null ||
      item.retail_gbp === "" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return;
    }
    if (!pricesByYear.has(year)) {
      pricesByYear.set(year, []);
    }
    pricesByYear.get(year).push({
      price,
      setName: item.set_name,
      setNumber: item.set_number,
    });
  });

  return [...pricesByYear]
    .map(([year, sets]) => {
      const topSets = sets.sort((a, b) => b.price - a.price).slice(0, 5);
      return {
        year,
        meanPrice: d3.mean(topSets, (item) => item.price),
        topSets,
      };
    })
    .sort((a, b) => a.year - b.year);
}

function setChartNotes(note, sentences) {
  d3.select(note).selectAll("li")
    .data(sentences)
    .join("li")
    .text((sentence) => sentence);
}

function drawTopFivePriceChart(data, bigMacData) {
  const container = d3.select("#top-five-price-chart");
  const note = document.getElementById("top-five-price-note");
  const yearlyPrices = buildTopFiveAnnualPrices(data);
  container.html("");
  if (!yearlyPrices.length) {
    setChartNotes(note, ["No listed UK prices are available for this chart."]);
    return;
  }

  const width = Math.max(560, container.node().clientWidth);
  const height = 390;
  const margin = { top: 18, right: 67, bottom: 48, left: 67 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3.scaleBand()
    .domain(yearlyPrices.map((item) => item.year))
    .range([0, innerWidth])
    .padding(0.25);
  const y = d3.scaleLinear()
    .domain([0, d3.max(yearlyPrices, (item) => item.meanPrice) * 1.08])
    .nice()
    .range([innerHeight, 0]);
  const bigMacByYear = new Map(bigMacData
    .filter((item) => Number.isInteger(Number(item.year)) && Number(item.price_gbp) > 0)
    .map((item) => [Number(item.year), item]));
  const bigMacPrices = yearlyPrices
    .filter((item) => bigMacByYear.has(item.year))
    .map((item) => bigMacByYear.get(item.year));
  const baseYear = yearlyPrices.find((item) => item.year === 2001);
  const baseBigMac = bigMacByYear.get(2001);
  const alignmentFactor = baseYear && baseBigMac
    ? baseYear.meanPrice / Number(baseBigMac.price_gbp)
    : null;
  const bigMacY = alignmentFactor
    ? d3.scaleLinear()
      .domain([0, y.domain()[1] / alignmentFactor])
      .range([innerHeight, 0])
    : null;
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-hidden", "true");
  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  plot.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
  plot.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat((value) => `£${d3.format(",")(value)}`));
  if (bigMacY) {
    plot.append("g")
      .attr("class", "axis axis-big-mac")
      .attr("transform", `translate(${innerWidth},0)`)
      .call(d3.axisRight(bigMacY).ticks(5).tickFormat((value) => `£${d3.format("~g")(value)}`));
  }
  const tickEvery = Math.max(1, Math.ceil(yearlyPrices.length / Math.max(3, Math.floor(innerWidth / 75))));
  const tickIndexes = yearlyPrices
    .map((_item, index) => index)
    .filter((index) => index % tickEvery === 0);
  if (yearlyPrices.length - 1 - tickIndexes[tickIndexes.length - 1] < tickEvery) {
    tickIndexes.pop();
  }
  tickIndexes.push(yearlyPrices.length - 1);
  const tickYears = tickIndexes.map((index) => yearlyPrices[index].year);
  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));

  plot.selectAll(".top-five-price-bar")
    .data(yearlyPrices)
    .join("rect")
    .attr("class", "top-five-price-bar")
    .attr("x", (item) => x(item.year))
    .attr("y", (item) => y(item.meanPrice))
    .attr("width", x.bandwidth())
    .attr("height", (item) => innerHeight - y(item.meanPrice))
    .on("mouseenter", (event, item) => {
      const sets = item.topSets.map((set, index) =>
        `${index + 1}. ${set.setName} (${set.setNumber}) — ${formatCurrency(set.price, "GBP")}`,
      );
      showTooltip(
        event,
        `${item.year} Top 5 mean: ${formatCurrency(item.meanPrice, "GBP")}\n${sets.join("\n")}`,
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  if (bigMacY) {
    const bigMacLine = d3.line()
      .x((item) => x(Number(item.year)) + x.bandwidth() / 2)
      .y((item) => bigMacY(Number(item.price_gbp)));
    plot.append("path")
      .datum(bigMacPrices)
      .attr("class", "big-mac-price-line")
      .attr("d", bigMacLine);
    plot.selectAll(".big-mac-price-point")
      .data(bigMacPrices)
      .join("circle")
      .attr("class", "big-mac-price-point")
      .attr("cx", (item) => x(Number(item.year)) + x.bandwidth() / 2)
      .attr("cy", (item) => bigMacY(Number(item.price_gbp)))
      .attr("r", 4)
      .on("mouseenter", (event, item) => showTooltip(
        event,
        `${item.year} UK Big Mac: ${formatCurrency(item.price_gbp, "GBP")}`,
      ))
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);
  }

  setChartNotes(note, [
    "Bars average the five highest listed UK set prices each year.",
    bigMacY
      ? "The Big Mac line uses that year’s first GBP observation."
      : "Big Mac comparison unavailable: the 2001 GBP observation is missing.",
  ]);
}

function drawHighCostChart(data) {
  const container = d3.select("#high-cost-chart");
  const pricedSets = data.filter((set) =>
    Number.isInteger(Number(set.year_released)) &&
    set.retail_gbp !== null &&
    set.retail_gbp !== "" &&
    Number.isFinite(Number(set.retail_gbp)) &&
    Number(set.retail_gbp) > 0,
  );
  const yearly = d3.rollups(
    pricedSets,
    (sets) => {
      const over100 = sets.filter((set) => Number(set.retail_gbp) > 100).length;
      return {
        total: sets.length,
        over100,
        share: over100 / sets.length,
      };
    },
    (item) => Number(item.year_released),
  )
    .map(([year, counts]) => ({ year, ...counts }))
    .sort((a, b) => a.year - b.year);

  container.html("");
  if (!yearly.length) {
    container.text("No annual set data is available for this chart.");
    return;
  }

  const width = Math.max(760, container.node().clientWidth);
  const height = 410;
  const margin = { top: 22, right: 62, bottom: 48, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3.scaleBand()
    .domain(yearly.map((item) => item.year))
    .range([0, innerWidth])
    .padding(0.27);
  const countY = d3.scaleLinear()
    .domain([0, d3.max(yearly, (item) => item.over100) * 1.12])
    .nice()
    .range([innerHeight, 0]);
  const shareY = d3.scaleLinear()
    .domain([0, Math.max(0.05, d3.max(yearly, (item) => item.share) * 1.15)])
    .nice()
    .range([innerHeight, 0]);
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-hidden", "true");
  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  plot.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(countY).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .select(".domain")
    .remove();
  plot.append("g")
    .attr("class", "axis axis-high-cost-count")
    .call(d3.axisLeft(countY).ticks(5).tickFormat(d3.format("d")));
  plot.append("g")
    .attr("class", "axis axis-high-cost-share")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(d3.axisRight(shareY).ticks(5).tickFormat(d3.format(".0%")));
  const tickStep = Math.max(1, Math.ceil(yearly.length / Math.max(3, Math.floor(innerWidth / 80))));
  const tickYears = yearly
    .filter((_item, index) => index % tickStep === 0 || index === yearly.length - 1)
    .map((item) => item.year);
  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));

  plot.selectAll(".high-cost-bar")
    .data(yearly)
    .join("rect")
    .attr("class", "high-cost-bar")
    .attr("x", (item) => x(item.year))
    .attr("y", (item) => countY(item.over100))
    .attr("width", x.bandwidth())
    .attr("height", (item) => innerHeight - countY(item.over100));
  plot.append("path")
    .datum(yearly)
    .attr("class", "high-cost-share-line")
    .attr("d", d3.line()
      .x((item) => x(item.year) + x.bandwidth() / 2)
      .y((item) => shareY(item.share)));
  plot.selectAll(".high-cost-share-point")
    .data(yearly)
    .join("circle")
    .attr("class", "high-cost-share-point")
    .attr("cx", (item) => x(item.year) + x.bandwidth() / 2)
    .attr("cy", (item) => shareY(item.share))
    .attr("r", 3.5);
  plot.selectAll(".high-cost-year-hit")
    .data(yearly)
    .join("rect")
    .attr("class", "high-cost-year-hit")
    .attr("x", (item) => x(item.year))
    .attr("y", 0)
    .attr("width", x.bandwidth())
    .attr("height", innerHeight)
    .on("mouseenter", (event, item) => showTooltip(
      event,
      `${item.year}\nOver £100: ${d3.format(",")(item.over100)} of ${d3.format(",")(item.total)} UK-priced sets (${d3.format(".1%")(item.share)})`,
    ))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
}

function drawStarWarsValueChart(data) {
  const container = d3.select("#star-wars-value-chart");
  const annualValues = d3.rollups(
    data.filter((item) =>
      item.theme_l2 === "Star Wars" &&
      Number.isInteger(Number(item.year_released)) &&
      item.ppp !== null &&
      item.ppp !== "" &&
      Number.isFinite(Number(item.ppp)) &&
      Number(item.ppp) > 0,
    ),
    (sets) => {
      const values = sets.map((item) => Number(item.ppp)).sort((a, b) => a - b);
      return {
        count: values.length,
        lowerQuartile: d3.quantileSorted(values, 0.25),
        median: d3.quantileSorted(values, 0.5),
        upperQuartile: d3.quantileSorted(values, 0.75),
      };
    },
    (item) => Number(item.year_released),
  )
    .map(([year, summary]) => ({ year, ...summary }))
    .sort((a, b) => a.year - b.year);

  container.html("");
  if (!annualValues.length) {
    container.text("No Star Wars sets with pieces-per-pound values are available.");
    return;
  }

  const width = Math.max(640, container.node().clientWidth);
  const height = 390;
  const margin = { top: 18, right: 28, bottom: 48, left: 67 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3.scalePoint()
    .domain(annualValues.map((item) => item.year))
    .range([0, innerWidth])
    .padding(0.35);
  const y = d3.scaleLinear()
    .domain([0, d3.max(annualValues, (item) => item.upperQuartile) * 1.1])
    .nice()
    .range([innerHeight, 0]);
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-hidden", "true");
  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left)
    .attr("y", 13)
    .text("Pieces per £");

  plot.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
  plot.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~g")));
  const tickEvery = Math.max(1, Math.ceil(annualValues.length / Math.max(3, Math.floor(innerWidth / 85))));
  const tickYears = annualValues
    .filter((_item, index) => index % tickEvery === 0)
    .map((item) => item.year);
  const lastYear = annualValues[annualValues.length - 1].year;
  if (!tickYears.includes(lastYear)) {
    tickYears.push(lastYear);
  }
  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));

  plot.append("path")
    .datum(annualValues)
    .attr("class", "star-wars-range")
    .attr("d", d3.area()
      .x((item) => x(item.year))
      .y0((item) => y(item.lowerQuartile))
      .y1((item) => y(item.upperQuartile)));
  plot.append("path")
    .datum(annualValues)
    .attr("class", "star-wars-median-line")
    .attr("d", d3.line()
      .x((item) => x(item.year))
      .y((item) => y(item.median)));
  plot.selectAll(".star-wars-median-point")
    .data(annualValues)
    .join("circle")
    .attr("class", "star-wars-median-point")
    .attr("cx", (item) => x(item.year))
    .attr("cy", (item) => y(item.median))
    .attr("r", 4);
  plot.selectAll(".star-wars-hit-area")
    .data(annualValues)
    .join("rect")
    .attr("class", "star-wars-hit-area")
    .attr("x", (item) => x(item.year) - x.step() / 2)
    .attr("width", x.step())
    .attr("height", innerHeight)
    .on("mouseenter", (event, item) => showTooltip(
      event,
      `${item.year} Star Wars (${item.count} sets)\nMedian: ${item.median.toFixed(1)} pieces per £\nMiddle 50%: ${item.lowerQuartile.toFixed(1)}–${item.upperQuartile.toFixed(1)} pieces per £`,
    ))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
}

function drawAnnualTopFivePriceChart(data) {
  const container = d3.select("#annual-top-five-price-chart");
  const pricedSets = data
    .filter((item) =>
      item.retail_gbp !== null &&
      item.retail_gbp !== "" &&
      Number.isFinite(Number(item.retail_gbp)) &&
      Number(item.retail_gbp) > 0 &&
      Number.isInteger(Number(item.year_released)),
    )
    .map((item) => ({ ...item, price: Number(item.retail_gbp) }));

  container.html("");
  if (!pricedSets.length) {
    container.text("No listed UK prices are available for this chart.");
    return;
  }

  const byYear = d3.group(pricedSets, (item) => Number(item.year_released));
  const latestYear = d3.max(pricedSets, (item) => Number(item.year_released));
  const yearlyTotals = d3.range(latestYear, latestYear - 10, -1)
    .map((year) => {
      const topSets = [...(byYear.get(year) || [])]
        .sort((a, b) =>
          b.price - a.price || String(a.set_number).localeCompare(String(b.set_number)),
        )
        .slice(0, 5);
      const starWarsSets = topSets.filter((item) => item.theme_l2 === "Star Wars");
      const otherSets = topSets.filter((item) => item.theme_l2 !== "Star Wars");
      const starWarsTotal = d3.sum(starWarsSets, (item) => item.price);
      const otherTotal = d3.sum(otherSets, (item) => item.price);
      return {
        year,
        count: topSets.length,
        topSets,
        starWarsTotal,
        otherTotal,
        total: starWarsTotal + otherTotal,
      };
    });

  const width = Math.max(760, container.node().clientWidth);
  const height = 520;
  const margin = { top: 16, right: 38, bottom: 48, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3.scaleLinear()
    .domain([0, Math.max(3000, d3.max(yearlyTotals, (item) => item.total))])
    .nice()
    .range([0, innerWidth]);
  const y = d3.scaleBand()
    .domain(yearlyTotals.map((item) => item.year))
    .range([0, innerHeight])
    .padding(0.2);
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-hidden", "true");
  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  plot.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""))
    .select(".domain")
    .remove();
  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((value) => `£${d3.format(",")(value)}`));
  plot.append("g")
    .attr("class", "axis annual-top-five-year-axis")
    .call(d3.axisLeft(y).tickSize(0).tickPadding(12).tickFormat(d3.format("d")))
    .select(".domain")
    .remove();

  const showYearTooltip = (event, item) => {
    const tooltip = d3.select("#chart-tooltip").text("").attr("hidden", null);
    tooltip.append("div")
      .attr("class", "annual-top-five-tooltip-heading")
      .text(`${item.year} top ${item.count} total: ${formatCurrency(item.total, "GBP")}`);
    const list = tooltip.append("ol").attr("class", "annual-top-five-tooltip-list");
    item.topSets.forEach((set) => {
      const row = list.append("li");
      row.append("span")
        .attr("class", set.theme_l2 === "Star Wars" ? "star-wars-set-name" : null)
        .text(set.set_name);
      row.append("span").text(` — ${formatCurrency(set.price, "GBP")}`);
    });
    moveTooltip(event);
  };
  plot.selectAll(".annual-top-five-bar.star-wars")
    .data(yearlyTotals)
    .join("rect")
    .attr("class", "annual-top-five-bar star-wars")
    .attr("x", 0)
    .attr("y", (item) => y(item.year))
    .attr("width", (item) => x(item.starWarsTotal))
    .attr("height", y.bandwidth())
    .on("mouseenter", showYearTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
  plot.selectAll(".annual-top-five-bar.other-theme")
    .data(yearlyTotals)
    .join("rect")
    .attr("class", "annual-top-five-bar other-theme")
    .attr("x", (item) => x(item.starWarsTotal))
    .attr("y", (item) => y(item.year))
    .attr("width", (item) => x(item.total) - x(item.starWarsTotal))
    .attr("height", y.bandwidth())
    .on("mouseenter", showYearTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
}

function adventMetricValue(set, key) {
  const value = set[key];
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function initializeAdventCalendars() {
  adventCalendarData = allSetData.filter((set) =>
    typeof set.set_name === "string" &&
    set.set_name.trim() !== "Advent Calendar" &&
    /^.+ Advent Calendar(?: \d{4})?$/.test(set.set_name) &&
    Number.isInteger(Number(set.year_released)) &&
    Number(set.year_released) >= 2005 &&
    set.theme_l2,
  );
  const themeSelect = document.getElementById("advent-calendar-theme");
  const themes = [...new Set(adventCalendarData.map((set) => set.theme_l2))].sort();
  themeSelect.add(new Option("All themes", "all"));
  themes.forEach((theme) => themeSelect.add(new Option(theme, theme)));
  themeSelect.value = "all";
  themeSelect.addEventListener("change", drawAdventCalendarChart);
}

function drawAdventCalendarChart() {
  const theme = document.getElementById("advent-calendar-theme").value;
  const sets = adventCalendarData
    .filter((set) => theme === "all" || set.theme_l2 === theme)
    .sort((a, b) => Number(a.year_released) - Number(b.year_released));
  const container = d3.select("#advent-calendar-chart");
  container.html("");
  if (!sets.length) {
    container.text("No matching Advent Calendar sets are available.");
    return;
  }

  const yearlyData = d3.rollups(
    sets,
    (yearSets) => {
      const meanMetric = (key) => {
        const values = yearSets.map((set) => adventMetricValue(set, key))
          .filter((value) => value !== null);
        return values.length ? d3.mean(values) : null;
      };
      return {
        year: Number(yearSets[0].year_released),
        sets: yearSets,
        retail_gbp: meanMetric("retail_gbp"),
        pieces: meanMetric("pieces"),
        minifigs: meanMetric("minifigs"),
      };
    },
    (set) => Number(set.year_released),
  ).map(([, summary]) => summary).sort((a, b) => a.year - b.year);
  const latest = yearlyData[yearlyData.length - 1];
  document.getElementById("advent-calendar-latest").textContent =
    theme === "all"
      ? `${latest.year} average · ${latest.sets.length} Advent calendars`
      : `Most recent match: ${latest.year} · ${latest.sets[0].set_name}`;
  document.getElementById("advent-calendar-price").textContent =
    formatCurrency(latest.retail_gbp, "GBP");
  document.getElementById("advent-calendar-pieces").textContent =
    latest.pieces === null ? "—" : latest.pieces.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  document.getElementById("advent-calendar-minifigs").textContent =
    latest.minifigs === null ? "—" : latest.minifigs.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  container.attr("aria-label", `Annual average UK price, pieces and minifigures for ${theme === "all" ? "all themes" : theme} Advent Calendar sets`);

  const firstYear = yearlyData[0].year;
  const lastYear = latest.year;
  const years = d3.range(firstYear, lastYear + 1);
  const byYear = new Map(yearlyData.map((item) => [item.year, item]));
  const series = years.map((year) => byYear.get(year) || { year });
  const width = Math.max(820, container.node().clientWidth);
  const height = 460;
  const margin = { top: 22, right: 118, bottom: 52, left: 62 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3.scaleBand().domain(years).range([0, innerWidth]).padding(0.22);
  const xCenter = (year) => x(year) + x.bandwidth() / 2;
  const scaleFor = (key) => d3.scaleLinear()
    .domain([0, Math.max(1, d3.max(yearlyData, (item) => item[key]) || 0)])
    .nice(4)
    .range([innerHeight, 0]);
  const priceY = scaleFor("retail_gbp");
  const piecesY = scaleFor("pieces");
  const minifigsY = scaleFor("minifigs");
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-hidden", "true");
  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  plot.append("g")
    .attr("class", "grid axis-advent-price")
    .call(d3.axisLeft(priceY).ticks(4).tickSize(-innerWidth)
      .tickFormat((value) => `£${d3.format("~g")(value)}`))
    .select(".domain")
    .remove();
  plot.append("g")
    .attr("class", "axis axis-advent-pieces")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(d3.axisRight(piecesY).ticks(4).tickFormat(d3.format("d")));
  plot.append("g")
    .attr("class", "axis axis-advent-minifigs")
    .attr("transform", `translate(${innerWidth + 58},0)`)
    .call(d3.axisRight(minifigsY)
      .tickValues(minifigsY.ticks(4).filter(Number.isInteger))
      .tickFormat(d3.format("d")));

  const tooltipText = (item) => {
    const description = theme === "all"
      ? `${item.sets.length} calendars · annual average`
      : item.sets[0].set_name;
    const pieces = item.pieces === null ? "—" : item.pieces.toLocaleString("en-GB", { maximumFractionDigits: 1 });
    const minifigs = item.minifigs === null ? "—" : item.minifigs.toLocaleString("en-GB", { maximumFractionDigits: 1 });
    return `${item.year} · ${description}\nUK price: ${formatCurrency(item.retail_gbp, "GBP")}\nPieces: ${pieces}\nMinifigures: ${minifigs}`;
  };
  const showYearTooltip = (event, item) => showTooltip(event, tooltipText(item));
  plot.selectAll(".advent-minifig-bar")
    .data(yearlyData)
    .join("rect")
    .attr("class", (item) => `advent-minifig-bar${item.minifigs === null ? " is-missing" : ""}`)
    .attr("x", (item) => x(item.year) + x.bandwidth() * 0.15)
    .attr("y", (item) => item.minifigs === null ? innerHeight - 18 : minifigsY(item.minifigs))
    .attr("width", x.bandwidth() * 0.7)
    .attr("height", (item) => item.minifigs === null ? 18 : innerHeight - minifigsY(item.minifigs))
    .on("mouseenter", showYearTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);
  plot.selectAll(".advent-minifig-missing-label")
    .data(yearlyData.filter((item) => item.minifigs === null))
    .join("text")
    .attr("class", "advent-minifig-missing-label")
    .attr("x", (item) => xCenter(item.year))
    .attr("y", innerHeight - 5)
    .attr("text-anchor", "middle")
    .text("?");

  [
    { key: "retail_gbp", scale: priceY, className: "advent-price" },
    { key: "pieces", scale: piecesY, className: "advent-pieces" },
  ].forEach((metric) => {
    const line = d3.line()
      .defined((item) => item[metric.key] !== null && item[metric.key] !== undefined)
      .x((item) => xCenter(item.year))
      .y((item) => metric.scale(item[metric.key]));
    plot.append("path")
      .datum(series)
      .attr("class", `advent-combined-line ${metric.className}`)
      .attr("d", line);
    plot.selectAll(`.${metric.className}-point`)
      .data(yearlyData.filter((item) => item[metric.key] !== null))
      .join("circle")
      .attr("class", `advent-combined-point ${metric.className}-point`)
      .attr("cx", (item) => xCenter(item.year))
      .attr("cy", (item) => metric.scale(item[metric.key]))
      .attr("r", 4.5)
      .on("mouseenter", showYearTooltip)
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);
  });

  const step = Math.max(1, Math.ceil((lastYear - firstYear) / 6));
  const tickYears = d3.range(firstYear, lastYear + 1, step);
  if (tickYears[tickYears.length - 1] !== lastYear) tickYears.push(lastYear);
  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));
}

function parseDate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function themeSummary(data, groupField) {
  return d3
    .rollups(
      data.filter((item) => item[groupField]),
      (items) => {
        const pieces = numericValues(items, "pieces");
        const prices = numericValues(items, "retail_gbp");
        return {
          name: items[0][groupField],
          count: items.length,
          medianPieces: median(pieces),
          medianPrice: median(prices),
        };
      },
      (item) => item[groupField],
    )
    .map(([, summary]) => summary)
    .filter(
      (item) =>
        Number.isFinite(item.medianPieces) && Number.isFinite(item.medianPrice),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function drawScatter(containerSelector, summaries, onPointClick, ariaLabel) {
  const container = d3.select(containerSelector);
  const width = container.node().clientWidth;
  const height = Math.max(440, summaries.length * 24);
  const legendWidth = 185;
  const margin = { top: 24, right: 12, bottom: 65, left: 76 };
  const innerWidth = Math.max(
    100,
    width - margin.left - margin.right - legendWidth,
  );
  const innerHeight = height - margin.top - margin.bottom;
  const xMax = d3.max(summaries, (item) => item.medianPrice) || 1;
  const yMax = d3.max(summaries, (item) => item.medianPieces) || 1;
  const x = d3
    .scaleLinear()
    .domain([0, xMax * 1.08])
    .nice()
    .range([0, innerWidth]);
  const y = d3
    .scaleLinear()
    .domain([0, yMax * 1.08])
    .nice()
    .range([innerHeight, 0]);
  const radius = d3
    .scaleSqrt()
    .domain([0, d3.max(summaries, (item) => item.count) || 1])
    .range([4, 22]);
  const color = d3
    .scaleOrdinal(themeColors)
    .domain(summaries.map((item) => item.name));
  const svg = container
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("aria-label", ariaLabel);
  const plot = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  plot
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));
  plot.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
  plot
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(6)
        .tickFormat((value) =>
          new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
          }).format(value),
        ),
    );
  plot
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 48)
    .text("Median UK price (£)");
  plot
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -55)
    .text("Median number of pieces");

  plot
    .selectAll(".scatter-point")
    .data(summaries, (item) => item.name)
    .join("circle")
    .attr("class", "scatter-point")
    .attr("cx", (item) => x(item.medianPrice))
    .attr("cy", (item) => y(item.medianPieces))
    .attr("r", (item) => radius(item.count))
    .attr("fill", (item) => color(item.name))
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (item) => `${item.name}, ${item.count} sets`)
    .on("mouseenter", (event, item) =>
      showTooltip(
        event,
        `${item.name}: ${item.count.toLocaleString()} sets, median ${formatCurrency(item.medianPrice, "GBP")}, ${item.medianPieces.toLocaleString()} pieces`,
      ),
    )
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (_event, item) => onPointClick(item))
    .on("keydown", (event, item) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onPointClick(item);
      }
    });

  const legend = svg
    .append("g")
    .attr("class", "chart-legend")
    .attr(
      "transform",
      `translate(${margin.left + innerWidth + 18},${margin.top})`,
    );
  const legendRows = legend
    .selectAll("g")
    .data(summaries, (item) => item.name)
    .join("g")
    .attr("transform", (_item, index) => `translate(0,${index * 22})`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (item) => `Select ${item.name}`)
    .on("click", (_event, item) => onPointClick(item))
    .on("keydown", (event, item) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onPointClick(item);
      }
    });
  legendRows
    .append("circle")
    .attr("r", 6)
    .attr("cx", 5)
    .attr("cy", 5)
    .attr("fill", (item) => color(item.name))
    .attr("stroke", "#000");
  legendRows
    .append("text")
    .attr("x", 17)
    .attr("y", 9)
    .text((item) => item.name);
}

function drawThemeScatter() {
  const summaries = themeSummary(allSetData, "theme_l1");
  drawScatter(
    "#theme-scatter",
    summaries,
    (item) => {
      selectedThemeForTable = item.name;
      selectedSubThemeForTable = null;
      tablePage = 0;
      renderScatterFilteredTable();
      if (selectedThemeForSubTheme === item.name) {
        closeSubThemeChart();
      } else {
        drawSubThemeScatter(item.name);
      }
    },
    "Median UK set price and median piece count by theme group, sized by set count",
  );
}

function drawSubThemeScatter(parentTheme) {
  const section = document.getElementById("sub-theme-chart-section");
  const summaries = themeSummary(
    allSetData.filter((item) => item.theme_l1 === parentTheme),
    "theme_l2",
  );
  document.getElementById("sub-theme-chart-heading").textContent =
    `Typical Set Size and UK Price by Theme: ${parentTheme}`;
  section.hidden = false;
  selectedThemeForSubTheme = parentTheme;
  drawScatter(
    "#sub-theme-scatter",
    summaries,
    (item) => {
      selectedSubThemeForTable =
        selectedSubThemeForTable === item.name ? null : item.name;
      tablePage = 0;
      renderScatterFilteredTable();
    },
    `Median UK set price and median piece count by theme in ${parentTheme}, sized by set count`,
  );
}

function closeSubThemeChart() {
  document.getElementById("sub-theme-chart-section").hidden = true;
  selectedThemeForSubTheme = null;
  selectedSubThemeForTable = null;
  renderScatterFilteredTable();
  d3.select("#sub-theme-scatter").html("");
}

function renderScatterFilteredTable() {
  tableRows = allSetData
    .filter(
      (item) =>
        (!selectedThemeForTable || item.theme_l1 === selectedThemeForTable) &&
        (!selectedSubThemeForTable ||
          item.theme_l2 === selectedSubThemeForTable),
    )
    .sort(
      (a, b) =>
        a.released.localeCompare(b.released) ||
        a.set_number.localeCompare(b.set_number),
    );
  const selection = [
    selectedThemeForTable && `Theme Group: ${selectedThemeForTable}`,
    selectedSubThemeForTable && `Theme: ${selectedSubThemeForTable}`,
  ].filter(Boolean);
  document.getElementById("raw-data-heading").textContent = selection.length
    ? `Raw Data — ${selection.join(" / ")}`
    : "Raw Data";
  document.getElementById("clear-scatter-selection").hidden =
    selection.length === 0;
  tablePage = 0;
  renderRawTable();
}

function formatCurrency(value, currency) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
  return currency === "USD" ? formatted.replace("US$", "$") : formatted;
}

function measureTextWidth(text, font) {
  const canvas =
    measureTextWidth.canvas ||
    (measureTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  return context.measureText(String(text ?? "")).width;
}

function visibleRawColumns() {
  return rawColumns.filter(
    (column) =>
      !(column.key === "theme_l1" && selectedThemeForTable) &&
      !(column.key === "theme_l2" && selectedSubThemeForTable),
  );
}

function formatColumnValue(column, row) {
  const value = row[column.key];
  if (column.currency) {
    return formatCurrency(value, column.currency);
  }
  return column.format ? column.format(value) : (value ?? "—");
}

function renderRawTable() {
  const table = document.getElementById("data-table");
  const visibleColumns = visibleRawColumns();
  const search = document
    .getElementById("table-search")
    .value.trim()
    .toLocaleLowerCase();
  const matchingRows = tableRows.filter((row) =>
    rawColumns.some((column) =>
      String(formatColumnValue(column, row) ?? "")
        .toLocaleLowerCase()
        .includes(search),
    ),
  );
  const sortedRows = [...matchingRows].sort((a, b) => {
    const left = a[tableSort.key];
    const right = b[tableSort.key];
    const comparison =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left ?? "").localeCompare(String(right ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
    return tableSort.direction === "asc" ? comparison : -comparison;
  });
  const pageSize = Number(document.getElementById("table-page-size").value);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  tablePage = Math.min(tablePage, pageCount - 1);
  const pageRows = sortedRows.slice(
    tablePage * pageSize,
    (tablePage + 1) * pageSize,
  );
  const tableContainerWidth = table.parentElement.clientWidth;
  const widths = calculateColumnWidths(
    visibleColumns,
    tableRows,
    tableContainerWidth,
  );
  table.style.width = `${Math.max(
    tableContainerWidth,
    widths.reduce((total, width) => total + width, 0),
  )}px`;

  const colgroup = document.createElement("colgroup");
  visibleColumns.forEach((column, index) => {
    const col = document.createElement("col");
    col.style.width = `${widths[index]}px`;
    colgroup.appendChild(col);
  });
  table.replaceChildren(
    colgroup,
    document.createElement("thead"),
    document.createElement("tbody"),
  );
  const thead = table.querySelector("thead");
  const headerRow = thead.insertRow();
  visibleColumns.forEach((column) => {
    const header = document.createElement("th");
    header.scope = "col";
    header.textContent = column.title;
    header.className = column.className;
    if (tableSort.key === column.key) {
      header.setAttribute(
        "aria-sort",
        tableSort.direction === "asc" ? "ascending" : "descending",
      );
    }
    header.addEventListener("click", () => {
      tableSort = {
        key: column.key,
        direction:
          tableSort.key === column.key && tableSort.direction === "asc"
            ? "desc"
            : "asc",
      };
      renderRawTable();
    });
    headerRow.appendChild(header);
  });
  const tbody = table.querySelector("tbody");
  pageRows.forEach((row) => {
    const tr = tbody.insertRow();
    visibleColumns.forEach((column) => {
      const cell = tr.insertCell();
      cell.className = column.className;
      cell.textContent = formatColumnValue(column, row);
    });
  });
  document.getElementById("table-info").textContent = sortedRows.length
    ? `Showing ${tablePage * pageSize + 1} to ${Math.min((tablePage + 1) * pageSize, sortedRows.length)} of ${sortedRows.length} entries`
    : "Showing 0 to 0 of 0 entries";
  document.getElementById("table-previous").disabled = tablePage === 0;
  document.getElementById("table-next").disabled = tablePage >= pageCount - 1;
  renderPageButtons(pageCount);
}

function calculateColumnWidths(columns, data, tableWidth) {
  const tableStyle = getComputedStyle(document.getElementById("data-table"));
  const font = tableStyle.font;
  const compactWidths = columns.map((column) => {
    if (
      column.key === "set_number" ||
      column.key === "pieces" ||
      column.currency
    ) {
      return Math.ceil(measureTextWidth(column.title, `bold ${font}`) + 24);
    }
    return null;
  });
  const desiredThemeWidths = columns.map((column) => {
    if (!["theme_l1", "theme_l2", "theme_l3"].includes(column.key)) {
      return null;
    }
    const widest = Math.max(
      measureTextWidth(column.title, `bold ${font}`),
      ...data.map((row) =>
        measureTextWidth(formatColumnValue(column, row), font),
      ),
    );
    return Math.min(160, Math.ceil(widest + 24));
  });
  const compactTotal = compactWidths.reduce(
    (sum, width) => sum + (width || 0),
    0,
  );
  const maxSetNameWidth = Math.max(240, tableWidth - compactTotal - 8);
  let nameWidth = maxSetNameWidth;
  const desiredThemeTotal = desiredThemeWidths.reduce(
    (sum, width) => sum + (width || 0),
    0,
  );
  const availableThemeTotal = Math.max(0, tableWidth - compactTotal - 240 - 8);
  const scale =
    desiredThemeTotal > availableThemeTotal
      ? availableThemeTotal / desiredThemeTotal
      : 1;
  const widths = columns.map((column, index) => {
    if (compactWidths[index] !== null) {
      return compactWidths[index];
    }
    if (column.key === "set_name") {
      return nameWidth;
    }
    if (desiredThemeWidths[index] !== null) {
      return Math.max(60, Math.floor(desiredThemeWidths[index] * scale));
    }
    return 100;
  });
  const total = widths.reduce((sum, width) => sum + width, 0);
  nameWidth = Math.max(240, nameWidth + tableWidth - total - 2);
  const nameIndex = columns.findIndex((column) => column.key === "set_name");
  if (nameIndex >= 0) {
    widths[nameIndex] = nameWidth;
  }
  return widths;
}

function renderPageButtons(pageCount) {
  const list = document.getElementById("table-page-list");
  list.replaceChildren();
  const first = Math.max(0, Math.min(tablePage - 2, pageCount - 5));
  const last = Math.min(pageCount - 1, first + 4);

  const appendPageButton = (page) => {
    const button = document.createElement("button");
    button.className = "page-button";
    button.type = "button";
    button.textContent = String(page + 1);
    if (page === tablePage) {
      button.setAttribute("aria-current", "page");
    }
    button.addEventListener("click", () => {
      tablePage = page;
      renderRawTable();
    });
    list.appendChild(button);
  };

  const appendEllipsis = () => {
    const ellipsis = document.createElement("span");
    ellipsis.textContent = " … ";
    list.appendChild(ellipsis);
  };

  if (first > 0) {
    appendPageButton(0);
    if (first > 1) {
      appendEllipsis();
    }
  }

  for (let page = first; page <= last; page += 1) {
    appendPageButton(page);
  }

  if (last < pageCount - 1) {
    if (last < pageCount - 2) {
      appendEllipsis();
    }
    appendPageButton(pageCount - 1);
  }
}

function redrawCharts() {
  if (!allSetData.length) {
    return;
  }
  drawLineChart(
    getDropdownFilteredData(),
    document.getElementById("chart-type-selector").value,
  );
  drawTopFivePriceChart(allSetData, annualBigMacData);
  if (!document.getElementById("star-wars-panel").hidden) {
    drawStarWarsValueChart(allSetData);
    drawAnnualTopFivePriceChart(allSetData);
  }
  if (!document.getElementById("advent-calendar-panel").hidden) {
    drawAdventCalendarChart();
  }
  if (!document.getElementById("high-cost-panel").hidden) {
    drawHighCostChart(allSetData);
  }
  drawThemeScatter();
  if (selectedThemeForSubTheme) {
    drawSubThemeScatter(selectedThemeForSubTheme);
  }
  renderRawTable();
}

function showTooltip(event, text) {
  d3.select("#chart-tooltip").text(text).attr("hidden", null);
  moveTooltip(event);
}

function moveTooltip(event) {
  const tooltip = d3.select("#chart-tooltip");
  const { width, height } = tooltip.node().getBoundingClientRect();
  let left = event.clientX + 12;
  let top = event.clientY + 12;
  if (left + width > window.innerWidth - 8) {
    left = event.clientX - width - 12;
  }
  if (top + height > window.innerHeight - 8) {
    top = event.clientY - height - 12;
  }
  tooltip
    .style("left", `${Math.max(8, left)}px`)
    .style("top", `${Math.max(8, top)}px`);
}

function hideTooltip() {
  d3.select("#chart-tooltip").attr("hidden", true);
}
