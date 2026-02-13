window.addEventListener("beforeunload", () => {
  if (elapsedSeconds > 0) {
    localStorage.setItem("jobTimer_" + jobId.value, elapsedSeconds);
  }
});



/* =========================
   LOAD JOB FROM QR
========================= */
const params = new URLSearchParams(window.location.search);
const jobIdFromQR = params.get("jobId");

const jobId = document.getElementById("jobId");
const orderId = document.getElementById("orderId");
const customer = document.getElementById("customer");
const requirement = document.getElementById("requirement");
const msg = document.getElementById("msg");

/* ===============================
   TIMER STATE (IMPORTANT)
=============================== */
let timerInterval = null;
let elapsedSeconds = 0;

/* =========================
   QR SUCCESS → LOAD JOB
========================= */
async function loadJob() {
  if (!jobIdFromQR) return;

   const res = await fetch(`https://uniquecrm.netlify.app/operator.html/api/jobs/details/${jobIdFromQR}`)
  const job = await res.json();

  if (!job.success) {
    alert("Invalid Job QR");
    return;
  }

  jobId.value = job.data.jobId;
orderId.value = job.data.orderId;
customer.value = job.data.customer;
requirement.value = job.data.requirement;

// ✅ MACHINE FILTERING
populateMachines(job.data.machines || []);

// ✅ DESIGN PREVIEW
loadDesignPreview(job.data.jobId);

}

loadJob();
function populateMachines(machineList) {
  const machineSelect = document.getElementById("machineName");
  machineSelect.innerHTML = `<option value="">Select Machine</option>`;

  if (machineList.length === 0) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.textContent = "No machine assigned by designer";
    machineSelect.appendChild(opt);
    return;
  }

  machineList.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    machineSelect.appendChild(opt);
  });
}


// 🔁 Restore timer if exists
const saved = localStorage.getItem("jobTimer_" + job.data.jobId);
if (saved) {
  startTimer(parseInt(saved));
  document.getElementById("activeActions").style.display = "block";
}


/* =========================
   START JOB
========================= */
async function startJob() {
  const operator = document.getElementById("operatorName").value;
  const machine = document.getElementById("machineName").value;

  if (!operator || !machine) {
    alert("Select operator & machine");
    return;
  }

  const res = await fetch("/api/production/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId.value,
      orderId: orderId.value,
      operator,
      machine
    })
  });

  const result = await res.json();

  if (result.success) {
    msg.innerText = "✅ Job Started Successfully";
    msg.style.color = "green";

    // 🔥 TIMER START (resume support)
    startTimer(result.elapsedSeconds || 0);

    // 🔥 SHOW HOLD / COMPLETE
    document.getElementById("activeActions").style.display = "block";
  } else {
    msg.innerText = "❌ Unable to start job";
    msg.style.color = "red";
  }
}

/* ===============================
   TIMER FUNCTIONS (FIXED)
=============================== */
function startTimer(fromSeconds = 0) {
  elapsedSeconds = fromSeconds;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    elapsedSeconds++;
    const min = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;
    document.getElementById("liveTimer").innerText =
      `${min}m ${sec}s`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/* ===============================
   HOLD JOB (FIXED)
=============================== */
async function holdJob() {
  const reason = prompt("Hold reason (required)");
  if (!reason) return;

  // 🛑 STOP TIMER
  stopTimer();

  await fetch("/api/production/hold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId.value,
      reason,
      elapsedSeconds
    })
  });

  alert("⏸ Job on HOLD");
}

/* ===============================
   COMPLETE JOB (FIXED)
=============================== */
async function completeJob() {
  if (!confirm("Complete this job?")) return;

  stopTimer();

  const res = await fetch("/api/production/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId.value,
      status: "QC_PENDING",
      totalSeconds: elapsedSeconds
    })
  });

  const result = await res.json();

  if (result.success) {
    alert("✅ Job sent to QC");
    document.getElementById("activeActions").style.display = "none";
  } else {
    alert("❌ Unable to complete job");
  }
}
  


/* ===============================
   DESIGN PREVIEW (READ ONLY)
=============================== */
async function loadDesignPreview(jobId) {
  const res = await fetch("/api/design/" + jobId);
  const data = await res.json();

  if (!data.success) return;

  document.getElementById("dpDesignNo").innerText = data.designNo;
  document.getElementById("dpDesigner").innerText = data.designer;

  const frame = document.getElementById("designFrame");
  frame.src = data.designUrl;

  document.getElementById("designPreviewCard").style.display = "block";
}


