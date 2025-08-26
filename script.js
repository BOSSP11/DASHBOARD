async function loadCSV(filePath) {
  const response = await fetch(filePath);
  const text = await response.text();
  const [headerLine, ...lines] = text.trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map(line => {
    const values = line.split(",");
    let row = {};
    headers.forEach((h, i) => row[h.trim()] = values[i] ? values[i].trim() : "");
    return row;
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return !isNaN(d) ? d.toISOString().split("T")[0] : null;
}

let rawData = [];
let lineChart, barChart, pieChart;

document.addEventListener("DOMContentLoaded", async () => {
  rawData = await loadCSV("ncr_ride_bookings.csv");
  initDashboard(rawData);
});

function initDashboard(data) {
  const columns = Object.keys(data[0]);
  const dateCol = columns.find(c => c.toLowerCase().includes("date")) || columns[0];
  const barangayCol = columns.find(c => c.toLowerCase().includes("barangay") || c.toLowerCase().includes("location")) || columns[1];
  const typeCol = columns.find(c => c.toLowerCase().includes("type")) || columns[2];

  const barangays = [...new Set(data.map(d => d[barangayCol]))].sort();
  const barangaySelect = document.getElementById("barangay-filter");
  barangays.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    barangaySelect.appendChild(opt);
  });

  document.getElementById("apply-filter").onclick = () => {
    const from = document.getElementById("date-from").value;
    const to = document.getElementById("date-to").value;
    const brgy = barangaySelect.value;
    let filtered = data;
    if (from) filtered = filtered.filter(d => formatDate(d[dateCol]) >= from);
    if (to) filtered = filtered.filter(d => formatDate(d[dateCol]) <= to);
    if (brgy !== "__all__") filtered = filtered.filter(d => d[barangayCol] === brgy);
    updateCharts(filtered, dateCol, barangayCol, typeCol);
    renderTable(filtered);
  };

  document.getElementById("reset-filter").onclick = () => {
    document.getElementById("date-from").value = "";
    document.getElementById("date-to").value = "";
    barangaySelect.value = "__all__";
    updateCharts(data, dateCol, barangayCol, typeCol);
    renderTable(data);
  };

  updateCharts(data, dateCol, barangayCol, typeCol);
  renderTable(data);
}

function updateCharts(data, dateCol, barangayCol, typeCol) {
  const ctxLine = document.getElementById("lineChart").getContext("2d");
  const ctxBar = document.getElementById("barChart").getContext("2d");
  const ctxPie = document.getElementById("pieChart").getContext("2d");

  let dailyCounts = {};
  data.forEach(d => {
    const day = formatDate(d[dateCol]);
    if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });
  const dates = Object.keys(dailyCounts).sort();
  const dailyVals = dates.map(d => dailyCounts[d]);

  let barangayCounts = {};
  data.forEach(d => {
    const b = d[barangayCol] || "Unknown";
    barangayCounts[b] = (barangayCounts[b] || 0) + 1;
  });
  let topBarangays = Object.entries(barangayCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  let typeCounts = {};
  data.forEach(d => {
    const t = d[typeCol] || "Unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  if (lineChart) lineChart.destroy();
  if (barChart) barChart.destroy();
  if (pieChart) pieChart.destroy();

  lineChart = new Chart(ctxLine, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Bookings",
        data: dailyVals,
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.1)",
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
      scales: { x: { ticks: { color: "#1e3a8a" } }, y: { beginAtZero: true, ticks: { color: "#1e3a8a" } } }
    }
  });

  barChart = new Chart(ctxBar, {
    type: "bar",
    data: {
      labels: topBarangays.map(x => x[0]),
      datasets: [{
        label: "Bookings",
        data: topBarangays.map(x => x[1]),
        backgroundColor: "#1e40af"
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
      scales: { x: { ticks: { color: "#1e3a8a" } }, y: { beginAtZero: true, ticks: { color: "#1e3a8a" } } }
    }
  });

  pieChart = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: Object.keys(typeCounts),
      datasets: [{
        data: Object.values(typeCounts),
        backgroundColor: ["#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => c.label + ": " + c.parsed } } }
    }
  });
}

function renderTable(data) {
  const container = document.getElementById("table-container");
  if (!data.length) { container.innerHTML = "<p>No data available</p>"; return; }
  const cols = Object.keys(data[0]);
  let html = "<table><thead><tr>" + cols.map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>";
  data.slice(0, 50).forEach(row => {
    html += "<tr>" + cols.map(c => "<td>" + row[c] + "</td>").join("") + "</tr>";
  });
  html += "</tbody></table>";
  container.innerHTML = html;
}
