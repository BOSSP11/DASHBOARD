let rawData = [];
let charts = {};

// Load CSV
Papa.parse("ncr_ride_bookings.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: function (results) {
    rawData = results.data;
    populateVehicleDropdown();
    populatePlaceDropdown();
    updateDashboard();
  }
});

// Populate vehicle dropdown
function populateVehicleDropdown() {
  const vehicleFilter = document.getElementById("vehicleFilter");
  const vehicles = [...new Set(rawData.map(d => d["Vehicle Type"]).filter(Boolean))];
  vehicles.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    vehicleFilter.appendChild(opt);
  });
}

// Populate place dropdown
function populatePlaceDropdown() {
  const placeFilter = document.getElementById("placeFilter");
  const places = [...new Set(rawData.map(d => d["Pickup Location"]).filter(Boolean))];
  places.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    placeFilter.appendChild(opt);
  });
}

// Apply filters
function getFilteredData() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const vehicle = document.getElementById("vehicleFilter").value;
  const place = document.getElementById("placeFilter").value;

  return rawData.filter(d => {
    if (!d.Date) return false;

    if (start && new Date(d.Date) < new Date(start)) return false;
    if (end && new Date(d.Date) > new Date(end)) return false;

    if (vehicle !== "all" && d["Vehicle Type"] !== vehicle) return false;
    if (place !== "all" && d["Pickup Location"] !== place) return false;

    return true;
  });
}

// Update dashboard
function updateDashboard() {
  const data = getFilteredData();

  // KPIs
  document.getElementById("kpi-total").textContent = data.length;
  document.getElementById("kpi-completed").textContent = data.filter(d => d["Booking Status"] === "Completed").length;
  document.getElementById("kpi-cancelled").textContent = data.filter(d => d["Booking Status"].includes("Cancelled") || d["Booking Status"] === "No Driver Found").length;
  
  const avgValue = data.reduce((a,b) => a+(+b["Booking Value"]||0),0)/ (data.length||1);
  document.getElementById("kpi-avg-value").textContent = avgValue.toFixed(2);
  
  const avgRating = data.reduce((a,b) => a+(+b["Driver Ratings"]||0),0)/ (data.length||1);
  document.getElementById("kpi-avg-ratings").textContent = avgRating.toFixed(2);

  const revenue = data.reduce((a,b)=>a+(+b["Booking Value"]||0),0);
  document.getElementById("kpi-revenue").textContent = "₱" + revenue.toLocaleString();

  // Top pickup/dropoff
  const pickupCounts = countBy(data,"Pickup Location");
  const dropoffCounts = countBy(data,"Dropoff Location");

  const topPickup = Object.entries(pickupCounts).sort((a,b)=>b[1]-a[1])[0];
  const topDrop = Object.entries(dropoffCounts).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById("kpi-top-pickup").textContent = topPickup ? topPickup[0] : "—";
  document.getElementById("kpi-top-dropoff").textContent = topDrop ? topDrop[0] : "—";

  // Charts
  renderCharts(data, pickupCounts, dropoffCounts);

  // Table
  renderTable(data);
}

// Count by field helper
function countBy(data, field) {
  return data.reduce((acc, row) => {
    let key = row[field];
    if (!key) return acc;
    acc[key] = (acc[key]||0)+1;
    return acc;
  }, {});
}

// Render charts
function renderCharts(data, pickupCounts, dropoffCounts) {
  Object.values(charts).forEach(c => c.destroy());

  // Bookings over time
  const byDate = {};
  data.forEach(d => {
    if (!d.Date) return;
    byDate[d.Date] = (byDate[d.Date]||0)+1;
  });
  charts.time = new Chart(document.getElementById("chartTime"), {
    type: "line",
    data: {labels:Object.keys(byDate),datasets:[{label:"Bookings",data:Object.values(byDate),borderColor:"#2563eb"}]}
  });

  // Status distribution
  const byStatus = {};
  data.forEach(d => { if(d["Booking Status"]) byStatus[d["Booking Status"]] = (byStatus[d["Booking Status"]]||0)+1; });
  charts.status = new Chart(document.getElementById("chartStatus"), {
    type:"doughnut",
    data:{labels:Object.keys(byStatus),datasets:[{data:Object.values(byStatus),backgroundColor:["#2563eb","#f43f5e","#facc15","#10b981"]}]}
  });

  // Vehicle usage
  const byVehicle = {};
  data.forEach(d => { if(d["Vehicle Type"]) byVehicle[d["Vehicle Type"]] = (byVehicle[d["Vehicle Type"]]||0)+1; });
  charts.vehicle = new Chart(document.getElementById("chartVehicle"), {
    type:"bar",
    data:{labels:Object.keys(byVehicle),datasets:[{label:"Rides",data:Object.values(byVehicle),backgroundColor:"#10b981"}]}
  });

  // Payment methods
  const byPay = {};
  data.forEach(d => { if(d["Payment Method"]) byPay[d["Payment Method"]] = (byPay[d["Payment Method"]]||0)+1; });
  charts.payment = new Chart(document.getElementById("chartPayment"), {
    type:"pie",
    data:{labels:Object.keys(byPay),datasets:[{data:Object.values(byPay),backgroundColor:["#3b82f6","#f59e0b","#ef4444","#22c55e"]}]}
  });

  // Scatter Distance vs Value
  const scatter = data.filter(d=>d["Ride Distance"]&&d["Booking Value"])
    .map(d=>({x:d["Ride Distance"],y:d["Booking Value"]}));
  charts.scatter = new Chart(document.getElementById("chartScatter"), {
    type:"scatter",
    data:{datasets:[{label:"Ride",data:scatter,backgroundColor:"#2563eb"}]}
  });

  // Top pickup/dropoff
  updateTopLocations("chartTopPickup", pickupCounts);
  updateTopLocations("chartTopDropoff", dropoffCounts);

  // Hourly booking trends
  updateHourlyChart(data);

  // Ratings distribution
  updateRatingsChart(data);
}

// Top location charts
function updateTopLocations(canvasId, counts) {
  let sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  let labels = sorted.map(d => d[0]);
  let values = sorted.map(d => d[1]);
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type:"bar",
    data:{labels,datasets:[{label:"Rides",data:values,backgroundColor:"#3b82f6"}]},
    options:{plugins:{legend:{display:false}}}
  });
}

// Hourly booking trends
function updateHourlyChart(data) {
  let hours = Array(24).fill(0);
  data.forEach(r => {
    let d = new Date(r["Booking Time"]);
    if (!isNaN(d)) hours[d.getHours()]++;
  });
  charts.hourly = new Chart(document.getElementById("chartHourly"), {
    type:"line",
    data:{labels:hours.map((_,i)=>i+":00"),datasets:[{label:"Bookings",data:hours,borderColor:"#22c55e"}]}
  });
}

// Ratings distribution
function updateRatingsChart(data) {
  let counts = {};
  data.forEach(r => {
    let rating = Math.round(r["Driver Ratings"]);
    if (rating) counts[rating] = (counts[rating]||0)+1;
  });
  let labels = Object.keys(counts).sort((a,b)=>a-b);
  let values = labels.map(k => counts[k]);
  charts.ratingsDist = new Chart(document.getElementById("chartRatingsDist"), {
    type:"bar",
    data:{labels,datasets:[{label:"Count",data:values,backgroundColor:"#f59e0b"}]},
    options:{plugins:{legend:{display:false}}}
  });
}

// Render table
function renderTable(data) {
  const table = document.getElementById("dataTable");
  const head = table.querySelector("thead");
  const body = table.querySelector("tbody");
  head.innerHTML = "";
  body.innerHTML = "";
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  head.innerHTML = "<tr>"+headers.map(h=>`<th>${h}</th>`).join("")+"</tr>";
  data.slice(0,20).forEach(row=>{
    body.innerHTML += "<tr>"+headers.map(h=>`<td>${row[h]||""}</td>`).join("")+"</tr>";
  });
}

// Event listeners
["startDate","endDate","vehicleFilter","placeFilter"].forEach(id=>{
  document.getElementById(id).addEventListener("change", updateDashboard);
});
