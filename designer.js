const table = document.getElementById("designerOrders");

let activeJobId = "";   // 🔑 single source of truth

/* =========================
   PAGE SWITCH
========================= */
function showDesignerPage(page) {
  document.querySelectorAll(".page").forEach(p =>
    p.classList.remove("active")
  );
  document.getElementById("page-" + page).classList.add("active");
}

/* =========================
   LOAD DASHBOARD
========================= */
async function loadDesignerDashboard() {
  table.innerHTML = "";

  let assigned = 0, inProgress = 0, completed = 0, production = 0;

  const res = await fetch("/api/orders/list");
  const orders = await res.json();

  orders.forEach(o => {

    if (o.status === "ASSIGNED") {
      assigned++;

      const r = table.insertRow();
      r.innerHTML = `
        <td>${o.orderId}</td>
        <td>${o.customerName}</td>
        <td>${o.requirement}</td>
        <td>ASSIGNED</td>
        <td>
          <button onclick="startDesign('${o.orderId}')">
            Start Design
          </button>
        </td>
      `;
    }

    if (o.status === "DESIGN_IN_PROGRESS") inProgress++;
    if (o.status === "DESIGN_COMPLETED") completed++;
    if (o.status === "PRODUCTION") production++;
  });

  kpiAssigned.innerText = assigned;
  kpiInProgress.innerText = inProgress;
  kpiCompleted.innerText = completed;
  kpiProduction.innerText = production;
}

/* =========================
   START DESIGN
========================= */
async function startDesign(orderId) {
  const res = await fetch("/api/orders/list");
  const orders = await res.json();
  const o = orders.find(x => x.orderId === orderId);
  if (!o) return;

  wsOrderId.value = o.orderId;
  wsCustomer.value = o.customerName;
  wsRequirement.value = o.requirement;

  wsDesignNo.value = "DES-" + Date.now();
  wsDesignDate.valueAsDate = new Date();

  activeJobId = "";  // reset
  qrCanvas.getContext("2d").clearRect(0,0,300,300);
  qrText.innerText = "";

  showDesignerPage("design");
}

/* =========================
   GENERATE QR
========================= */
function generateQR() {
  if (activeJobId) {
    alert("QR already generated");
    return;
  }

  const orderId = wsOrderId.value;
  if (!orderId) return alert("Order missing");

  activeJobId = "JOB-" + Date.now();

 new QRious({
  element: document.getElementById("qrCanvas"),
  size: 220,
  value: `https://upw-erp-backend.onrender.com/operator.html?jobId=${activeJobId}`
});

  qrText.innerText = "Job ID: " + activeJobId;
}

/* =========================
   COMPLETE DESIGN
========================= */
async function completeDesign() {
  if (!activeJobId) {
    alert("Generate QR first");
    return;
  }

  const designer = wsDesignerName.value.trim();
  if (!designer) {
    alert("Designer name required");
    return;
  }

  const res = await fetch("/api/jobs/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: activeJobId,
      orderId: wsOrderId.value,
      customer: wsCustomer.value,
      requirement: wsRequirement.value,
      designNo: wsDesignNo.value,
      designer
    })
  });

  const r = await res.json();

  if (!r.success) {
    alert("Job creation failed");
    return;
  }

  alert("✅ Design completed & job sent to production");

  loadDesignerDashboard();
  showDesignerPage("production");
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  showDesignerPage("dashboard");
  loadDesignerDashboard();
});

