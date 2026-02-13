/* =========================
   UPW ERP – DESIGNER FINAL
========================= */

// 🔒 Single source of truth
let activeJobId = "";

// DOM
const table = document.getElementById("designerOrders");

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
        <td>${o.status}</td>
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

  // reset
  activeJobId = "";
  qrCanvas.getContext("2d").clearRect(0, 0, 300, 300);
  qrText.innerText = "";
  btnComplete.disabled = true;

  showDesignerPage("design");
}

/* =========================
   GENERATE QR
========================= */
function generateQR() {

  /* ===============================
     STRICT VALIDATION
  =============================== */

  if (!wsOrderId.value) {
    alert("Order not loaded");
    return;
  }

  if (!wsDesignerName.value.trim()) {
    alert("Designer Name required");
    return;
  }

  if (!wsDesignType.value) {
    alert("Select Design Type (New / Rework)");
    return;
  }

  if (!wsMaterial.value.trim()) {
    alert("Material Used is required");
    return;
  }

  const machines = document.querySelectorAll(".machineChk:checked");
  if (machines.length === 0) {
    alert("Select at least one Machine");
    return;
  }

  if (!wsOperatorRemark.value.trim()) {
    alert("Operator Instructions required");
    return;
  }

  /* ===============================
     QR LOCK
  =============================== */
  if (activeJobId) {
    alert("QR already generated");
    return;
  }

  /* ===============================
     GENERATE QR
  =============================== */
  activeJobId = "JOB-" + Date.now();

  new QRious({
    element: qrCanvas,
    size: 220,
    value: activeJobId
  });

  qrText.innerText = "Job ID: " + activeJobId;

  // enable submit ONLY now
  btnComplete.disabled = false;
}


/* =========================
   COMPLETE DESIGN
========================= */
async function completeDesign() {

  if (!activeJobId) {
    alert("Generate QR first");
    return;
  }

  const designerName = wsDesignerName.value.trim();
  if (!designerName) {
    alert("Designer name required");
    return;
  }

  const machines = [...document.querySelectorAll(".machineChk:checked")]
    .map(cb => cb.value)
    .join(", ");

  const payload = {
    jobId: activeJobId,
    orderId: wsOrderId.value,
    customer: wsCustomer.value,
    requirement: wsRequirement.value,
    designer: designerName,
    designType: document.getElementById("wsDesignType").value,
    material: document.getElementById("wsMaterial").value,
    machines: machines,
    operatorNote: document.getElementById("wsOperatorRemark").value
  };

  console.log("SENDING JOB:", payload);

  const res = await fetch("/api/jobs/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (!result.success) {
    alert("Job creation failed");
    return;
  }

  alert("✅ Job Created");

  activeJobId = "";
  showDesignerPage("dashboard");
  loadDesignerDashboard();
}


/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  btnComplete.disabled = true;
  showDesignerPage("dashboard");
  loadDesignerDashboard();
});
