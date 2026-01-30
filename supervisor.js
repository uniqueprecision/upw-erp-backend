/* ===============================
   SUPERVISOR DASHBOARD
================================ */

/* ===============================
   LOAD SUPERVISOR KPI + LIVE JOBS
================================ */
async function loadSupervisor() {
  const res = await fetch("/api/supervisor/dashboard");
  const d = await res.json();

  // KPI
  document.getElementById("kRun").innerText = d.kpi.running;
  document.getElementById("kHold").innerText = d.kpi.hold;
  document.getElementById("kDone").innerText = d.kpi.completed;
  document.getElementById("kOp").innerText = d.kpi.operators;

  // LIVE PRODUCTION TABLE
  const t = document.getElementById("prodTable");
  t.innerHTML = "";

  d.jobs.forEach(j => {
    const r = t.insertRow();
    r.innerHTML = `
      <td>${j.jobId}</td>
      <td>${j.operator}</td>
      <td>${j.machine}</td>
      <td>${j.status}</td>
      <td>${j.startTime || "-"}</td>
      <td>${j.holdReason || "-"}</td>
    `;
  });
}

/* ===============================
   QC PENDING SECTION (IMPORTANT)
================================ */
async function loadQC() {
  const res = await fetch("/api/qc/pending");
  const jobs = await res.json();

  const t = document.getElementById("qcTable");
  t.innerHTML = "";

  if (jobs.length === 0) {
    const r = t.insertRow();
    r.innerHTML = `
      <td colspan="4" style="text-align:center; color:#888;">
        No jobs pending for QC
      </td>
    `;
    return;
  }

  jobs.forEach(j => {
    const r = t.insertRow();
    r.innerHTML = `
      <td>${j.jobId}</td>
      <td>${j.operator}</td>
      <td>${j.machine}</td>
      <td>
        <button onclick="openQC('${j.jobId}')">
          QC CHECK
        </button>
      </td>
    `;
  });
}


/* ===============================
   QC MODAL LOGIC
================================ */
let qcJobId = "";

function openQC(jobId) {
  qcJobId = jobId;
  document.getElementById("qcJobId").innerText = jobId;
  document.getElementById("qcRemark").value = "";
  document.getElementById("qcModal").style.display = "flex";
}

function closeQC() {
  document.getElementById("qcModal").style.display = "none";
}

/* ===============================
   QC APPROVE → DELIVERY READY
================================ */
async function qcApprove() {
  await fetch("/api/qc/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: qcJobId,
      remark: document.getElementById("qcRemark").value || "QC Approved"
    })
  });

  closeQC();
  loadQC();
  loadSupervisor();
}

/* ===============================
   QC REJECT → BACK TO PRODUCTION
================================ */
async function qcReject() {
  const reason = document.getElementById("qcRemark").value.trim();
  if (!reason) {
    alert("Rejection reason mandatory");
    return;
  }

  await fetch("/api/qc/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: qcJobId,
      reason
    })
  });

  closeQC();
  loadQC();
  loadSupervisor();
}

/* ===============================
   AUTO REFRESH
================================ */
setInterval(() => {
  loadSupervisor();
  loadQC();
}, 5000);

// FIRST LOAD
loadSupervisor();
loadQC();
