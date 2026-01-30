/* =====================================================
   UPW ERP – FINAL ADMIN LOGIC (LOCKED VERSION)
   Customers → Enquiries → Orders
===================================================== */

/* =========================
   ELEMENTS
========================= */
const customerTable = document.getElementById("customerTable");
const customerSelect = document.getElementById("enqCustomer");
const enquiryTable = document.getElementById("enquiryTable");
const ordersTable = document.getElementById("ordersTable");
const custMsg = document.getElementById("custMsg");

/* =========================
   PAGE NAVIGATION (STABLE)
========================= */
function showPage(page) {
  // hide all pages
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
    if (page === "enquiries") {
  loadCustomers();
}

  });

  // show selected page
  const current = document.getElementById("page-" + page);
  if (current) current.classList.add("active");

  // 🔥 IMPORTANT PAGE-BASED LOADS
  if (page === "customers") {
    loadCustomers();
  }

  if (page === "enquiries") {
    loadCustomers();   // ⭐ CUSTOMER DROPDOWN FIX
    loadEnquiries();
  }

  if (page === "orders") {
    loadOrders();
  }

  // sidebar active
  document.querySelectorAll(".sidebar a").forEach(a => a.classList.remove("active"));
  if (window.event?.target) window.event.target.classList.add("active");
}


/* =========================
   LOAD CUSTOMERS
========================= */
async function loadCustomers() {
  customerTable.innerHTML = "";
  customerSelect.innerHTML = `<option value="">Select Customer</option>`;

  const res = await fetch("/api/customers/list");
  const customers = await res.json();

  customers.forEach(c => {
    /* TABLE */
    const row = customerTable.insertRow();
    row.innerHTML = `
      <td>${c.id}</td>
      <td>${c.customerName}</td>
      <td>${c.companyName || "-"}</td>
      <td>${c.mobile}</td>
      <td>${c.email || "-"}</td>
      <td>${c.status || "Active"}</td>
    `;

    /* DROPDOWN */
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.customerName;
    customerSelect.appendChild(opt);
  });
}

/* =========================
   ADD CUSTOMER
========================= */
async function addCustomer() {
  const payload = {
    customerName: custName.value.trim(),
    companyName: companyName.value.trim(),
    contactPerson: contactPerson.value.trim(),
    mobile: custPhone.value.trim(),
    alternateMobile: altPhone.value.trim(),
    email: custEmail.value.trim(),
    industry: industry.value.trim(),
    address: address.value.trim(),
    city: city.value.trim(),
    state: state.value.trim(),
    pincode: pincode.value.trim(),
    country: country.value.trim(),
    gstNo: gst.value.trim(),
    panNo: pan.value.trim(),
    paymentTerms: paymentTerms.value,
    creditLimit: creditLimit.value.trim(),
    status: customerStatus.value,
    source: source.value,
    salesPerson: salesPerson.value.trim(),
    notes: notes.value.trim()
  };

  if (!payload.customerName || !payload.mobile) {
    alert("Customer Name & Mobile required");
    return;
  }

  const res = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (result.success) {
    custMsg.innerText = "Customer saved successfully ✓";
    custMsg.style.color = "green";
    document.querySelectorAll("#page-customers input, #page-customers select")
      .forEach(i => i.value = "");
    loadCustomers();
  } else {
    custMsg.innerText = "Error saving customer";
    custMsg.style.color = "red";
  }
}

/* =========================
   ADD ENQUIRY
========================= */
async function addEnquiry() {
  const payload = {
    customerId: enqCustomer.value,
    customerName: enqCustomer.options[enqCustomer.selectedIndex]?.text,
    priority: enqPriority.value,
    partName: partName.value.trim(),
    quantity: quantity.value.trim(),
    material: material.value,
    drawing: drawing.value,
    process: process.value,
    tolerance: tolerance.value.trim(),
    surface: surface.value.trim(),
    delivery: delivery.value.trim()
  };

  if (!payload.customerId || !payload.partName || !payload.quantity) {
    alert("Customer, Part & Quantity required");
    return;
  }

  const res = await fetch("/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  if (result.success) {
    alert("Enquiry saved");
    document.querySelectorAll("#page-enquiries input, #page-enquiries select")
      .forEach(i => i.value = "");
    loadEnquiries();
  }
}

/* =========================
   LOAD ENQUIRIES (WITH CONVERT)
========================= */
async function loadEnquiries() {
  enquiryTable.innerHTML = "";

  const res = await fetch("/api/enquiries/list");
  const enquiries = await res.json();

  enquiries.forEach(e => {
    const row = enquiryTable.insertRow();

    let actionHTML = "";

    /* =========================
       STEP 3B LOGIC
    ========================== */
    if (e.status === "NEW") {
  actionHTML = `
    <button 
      class="convert-btn"
      data-enquiry="${e.id}"
      data-customer="${e.customerName}"
      data-req="${e.requirement}">
      Convert → Order
    </button>

    <button 
      class="lost-btn"
      data-enquiry="${e.id}">
      Mark Lost
    </button>
  
      `;
    } else if (e.status === "CONVERTED") {
      actionHTML = `<span style="color:green;font-weight:600;">Converted</span>`;
    } else if (e.status === "LOST") {
      actionHTML = `<span style="color:red;font-weight:600;">Lost</span>`;
    }

    row.innerHTML = `
      <td>${e.id}</td>
      <td>${e.customerName}</td>
      <td>${e.requirement || "-"}</td>
      <td>${actionHTML}</td>
    
    `;
  });
}

/* =========================
   CONVERT ENQUIRY → ORDER
========================= */
document.addEventListener("click", async (e) => {

  /* ===== CONVERT TO ORDER ===== */
  if (e.target.classList.contains("convert-btn")) {
    const enqId = e.target.dataset.enqid;
    const customerName = e.target.dataset.customer;
    const requirement = e.target.dataset.req;

    // 1️⃣ Create Order
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  enquiryId: e.target.dataset.enquiry,
  customerName: e.target.dataset.customer,
  requirement: e.target.dataset.req

})

    });

    const result = await res.json();
    if (!result.success) {
      alert("Order create failed");
      return;
    }

    document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("lost-btn")) return;

  const enquiryId = e.target.dataset.enquiry;

  const reason = prompt("Reason for marking enquiry as LOST?");
  if (!reason) return;

  const res = await fetch("/api/enquiries/lost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enquiryId,
      reason
    })
  });

  const result = await res.json();

  if (result.success) {
    alert("❌ Enquiry marked as LOST");
    loadEnquiries();   // refresh enquiry list
  } else {
    alert("Failed to mark enquiry as lost");
  }
});


    // 2️⃣ Update Enquiry Status
    await fetch("/api/enquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enquiryId: enqId,
        status: "CONVERTED"
      })
    });

    alert("✅ Enquiry converted to Order");

    loadEnquiries();
    loadOrders();
    showPage("orders");
  }

  /* ===== MARK LOST ===== */
  if (e.target.classList.contains("lost-btn")) {
    const enqId = e.target.dataset.enqid;

    await fetch("/api/enquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enquiryId: enqId,
        status: "LOST"
      })
    });

    alert("❌ Enquiry marked as Lost");
    loadEnquiries();
  }

});

/* =========================
   LOAD ORDERS
========================= */
async function loadOrders() {
  ordersTable.innerHTML = "";

  const res = await fetch("/api/orders/list");
  const orders = await res.json();

  orders.forEach(o => {
    const row = ordersTable.insertRow();
    row.innerHTML = `
      <td>${o.orderId}</td>
      <td>${o.customerName}</td>
      <td>${o.requirement}</td>
      <td>
        ${o.status === "ASSIGNED" ? `
  <span style="font-weight:600">${o.designer}</span>
` : `
  <select onchange="assignDesigner('${o.orderId}', this.value)">
    <option value="">Assign</option>
    <option>Rahul</option>
    <option>Amit</option>
    <option>Suresh</option>
  </select>
`}

      </td>
      <td>
  <span class="status-badge status-${o.status.toLowerCase()}">
    ${o.status}
  </span>
</td>

    `;
  });
}

/* =========================
   ASSIGN DESIGNER
========================= */
async function assignDesigner(orderId, designer) {
  if (!designer) return;

  await fetch("/api/orders/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, designer })
  });

  loadOrders();
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  showPage("dashboard");   // default landing

});

/* =====================================================
   ADMIN – LIVE DASHBOARD
===================================================== */
async function loadAdminLiveDashboard() {
  const res = await fetch("/api/admin/live-dashboard");
  const data = await res.json();

  // KPI
  document.getElementById("kpiTotal").innerText = data.kpi.total;
  document.getElementById("kpiDesign").innerText = data.kpi.design;
  document.getElementById("kpiProduction").innerText = data.kpi.production;
  document.getElementById("kpiHold").innerText = data.kpi.hold;
  document.getElementById("kpiCompleted").innerText = data.kpi.completed;

  // TABLE
  const tbody = document.getElementById("adminLiveTable");
  tbody.innerHTML = "";

  data.jobs.forEach(j => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${j.jobId}</td>
      <td>${j.customer}</td>
      <td>${j.part}</td>
      <td>${j.designer}</td>
      <td><span class="status ${j.status}">${j.status}</span></td>
      <td>${j.updatedAt || "-"}</td>
    `;
  });
}

// AUTO REFRESH (every 8 sec)
setInterval(loadAdminLiveDashboard, 8000);

// FIRST LOAD
document.addEventListener("DOMContentLoaded", loadAdminLiveDashboard);

async function loadOperatorPerformance() {
  const op = document.getElementById("opName").value;
  const month = document.getElementById("opMonth").value;

  const res = await fetch(
    `/api/operator/performance?operator=${op}&month=${month}`
  );
  const d = await res.json();

  document.getElementById("opJobs").innerText = d.jobs;
  document.getElementById("opWork").innerText = d.workHours + " hrs";
  document.getElementById("opHold").innerText = d.holdHours + " hrs";
  document.getElementById("opEff").innerText = d.efficiency + "%";
}

