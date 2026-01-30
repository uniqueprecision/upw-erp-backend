/* ===============================
   UPW ERP – FINAL STABLE BACKEND
   Google Sheets as Database
================================ */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { google } = require("googleapis");

const app = express();
const PORT = 3000;

/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   STATIC FRONTEND
================================ */

app.use(express.static(path.join(__dirname, "public")));


/* ===============================
   ROOT
================================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "admin.html"));
});

/* ===============================
   GOOGLE SHEETS CONFIG
================================ */
const SPREADSHEET_ID = "1Ie4iQt-1h1UIynTMuUamn5icM-K0WxZ5KtWwJpOJb0I";

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

/* ======================================================
   CUSTOMER MASTER
====================================================== */
app.post("/api/customers", async (req, res) => {
  try {
    const c = req.body;
    const sh = await getSheets();

    const customerId = "UPW-CUST-" + Date.now();
    const now = new Date().toLocaleString();

    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Customers!A:W",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          customerId, c.customerName || "", c.companyName || "",
          c.contactPerson || "", c.mobile || "", c.alternateMobile || "",
          c.email || "", c.industry || "", c.address || "",
          c.city || "", c.state || "", c.pincode || "",
          c.country || "", c.gstNo || "", c.panNo || "",
          c.paymentTerms || "", c.creditLimit || "",
          c.status || "Active", c.source || "",
          c.salesPerson || "", c.notes || "",
          now, now
        ]]
      }
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/customers/list", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Customers!A:W",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
    id: r[0], customerName: r[1], companyName: r[2],
    mobile: r[4], email: r[6], status: r[17]
  })));
});

/* ======================================================
   ENQUIRIES
====================================================== */
app.post("/api/enquiries", async (req, res) => {
  const d = req.body;
  const sh = await getSheets();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "ENQ-" + Date.now(),
        d.customerId, d.customerName,
        new Date().toLocaleDateString(),
        "Admin", d.priority || "",
        d.partName, d.quantity, d.material,
        d.drawing, d.process, d.tolerance,
        d.surface, d.delivery,
        "NEW", new Date().toLocaleString()
      ]]
    }
  });

  res.json({ success: true });
});

app.get("/api/enquiries/list", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
    id: r[0],
    customerName: r[2],
    requirement: r[6],
    status: r[14]
  })));
});

/* ======================================================
   ORDERS
====================================================== */
app.post("/api/orders", async (req, res) => {
  const { enquiryId, customerName, requirement } = req.body;
  const sh = await getSheets();

  const enq = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
  });

  const rows = enq.data.values;
  const idx = rows.findIndex(r => r[0] === enquiryId);

  if (rows[idx][14] !== "NEW")
    return res.json({ success: false });

  const orderId = "ORD-" + Date.now();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[orderId, customerName, requirement, "", "CREATED"]]
    }
  });

  rows[idx][14] = "CONVERTED";

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true, orderId });
});

app.get("/api/orders/list", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
    orderId: r[0],
    customerName: r[1],
    requirement: r[2],
    designer: r[3],
    status: r[4]
  })));
});

app.post("/api/orders/assign", async (req, res) => {
  const { orderId, designer } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[0] === orderId);

  rows[idx][3] = designer;
  rows[idx][4] = "ASSIGNED";

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});

/* ======================================================
   OPERATOR – FETCH DESIGN (READ ONLY)
====================================================== */
app.get("/api/design/:jobId", async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Design_Log!A:F",
    });

    const rows = r.data.values || [];
    const data = rows.find(r => r[0] === jobId);

    if (!data) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      designNo: data[2],
      designer: data[3],
      designUrl: data[4]
    });

  } catch (e) {
    res.status(500).json({ success: false });
  }
});


/* ======================================================
   JOB DETAILS (QR SCAN)
====================================================== */
app.get("/api/jobs/details/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:F",
    });

    const rows = r.data.values || [];
    const job = rows.find(r => r[0] === jobId);

    if (!job) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      data: {
        jobId: job[0],
        orderId: job[1],
        customer: job[2],
        requirement: job[3],
      }
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ======================================================
   PRODUCTION START
====================================================== */
// START JOB
app.post("/api/production/start", async (req, res) => {
  const { jobId, orderId, operator, machine } = req.body;
  const sh = await getSheets();

  const prodId = "PROD-" + Date.now();
  const startTime = new Date().toISOString();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        prodId,
        jobId,
        orderId,
        operator,
        machine,
        "RUNNING",
        startTime,
        "",
        "",
        ""
      ]]
    }
  });

  res.json({ success: true });
});



/* ======================================================
   JOBS – DESIGNER
====================================================== */
app.post("/api/jobs/create", async (req, res) => {
  const { orderId, customer, requirement } = req.body;
  const sh = await getSheets();

  const jobId = "JOB-" + Date.now();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[jobId, orderId, customer, requirement, "CREATED", new Date().toLocaleString()]]
    }
  });

  const orders = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
  });

  const rows = orders.data.values;
  const idx = rows.findIndex(r => r[0] === orderId);
  rows[idx][4] = "LOCKED";

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true, jobId });
});

/* ======================================================
   DASHBOARD LIVE
====================================================== */
app.get("/api/dashboard/live", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:E",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
    orderId: r[0],
    customer: r[1],
    requirement: r[2],
    designer: r[3],
    status: r[4]
  })));
});

/* ======================================================
   QC MODULE
====================================================== */

/* 🔹 QC Pending Jobs */
app.get("/api/qc/pending", async (req, res) => {
  try {
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:F"
    });

    const rows = (r.data.values || []).slice(1);

    const pending = rows
      .filter(r => r[4] === "PRODUCTION_DONE")
      .map(r => ({
        jobId: r[0],
        orderId: r[1],
        customer: r[2],
        requirement: r[3],
        status: r[4]
      }));

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* 🔹 QC Submit (Approve / Reject) */
app.post("/api/qc/submit", async (req, res) => {
  try {
    const { jobId, orderId, result, remarks, qcBy } = req.body;
    const sh = await getSheets();

    const now = new Date();
    const qcId = "QC-" + Date.now();

    // Save QC record
    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "QC!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          qcId,
          jobId,
          orderId,
          result,
          remarks || "",
          qcBy,
          now.toLocaleDateString(),
          now.toLocaleTimeString()
        ]]
      }
    });

    // Update Job Status
    const jobRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:F"
    });

    const rows = jobRes.data.values;
    const idx = rows.findIndex(r => r[0] === jobId);

    if (idx > 0) {
      rows[idx][4] =
        result === "APPROVED"
          ? "QC_APPROVED"
          : "QC_REJECTED";

      await sh.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Jobs!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows }
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ======================================================
   ADMIN – SINGLE LIVE DASHBOARD (READ ONLY)
====================================================== */
app.get("/api/admin/live-dashboard", async (req, res) => {
  try {
    const sh = await getSheets();

    // JOBS MASTER
    const jobsRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:H"
    });

    const rows = (jobsRes.data.values || []).slice(1);

    let kpi = {
      total: 0,
      design: 0,
      production: 0,
      hold: 0,
      completed: 0
    };

    const jobs = rows.map(r => {
      const status = r[6] || "DESIGN";

      kpi.total++;
      if (status === "DESIGN") kpi.design++;
      if (status === "PRODUCTION") kpi.production++;
      if (status === "HOLD") kpi.hold++;
      if (status === "COMPLETED") kpi.completed++;

      return {
        jobId: r[0],
        orderId: r[1],
        customer: r[2],
        part: r[3],
        designer: r[5] || "-",
        status: status,
        updatedAt: r[7]
      };
    });

    res.json({ kpi, jobs });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dashboard fetch failed" });
  }
});

app.post("/api/production/start", async (req, res) => {
  try {
    const { jobId, orderId, operator, machine } = req.body;
    const sh = await getSheets();

    const prodId = "PROD-" + Date.now();
    const now = new Date().toLocaleString();

    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          prodId, jobId, orderId, operator, machine,
          "RUNNING", now, "", "", now
        ]]
      }
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/production/hold", async (req, res) => {
  const { jobId, reason } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId);

  rows[idx][5] = "HOLD";
  rows[idx][8] = reason;
  rows[idx][9] = new Date().toLocaleString();

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});

app.post("/api/production/complete", async (req, res) => {
  const { jobId } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId);

  rows[idx][5] = "COMPLETED";
  rows[idx][7] = new Date().toLocaleString();
  rows[idx][9] = new Date().toLocaleString();

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});

app.post("/api/production/complete", async (req, res) => {
  const { jobId } = req.body;
  const sh = await getSheets();

  // 1️⃣ Update Jobs status → QC_PENDING
  const jobs = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G"
  });

  const rows = jobs.data.values;
  const idx = rows.findIndex(r => r[0] === jobId);

  if (idx === -1) {
    return res.json({ success: false });
  }

  rows[idx][5] = "QC_PENDING"; // status column
  rows[idx][6] = new Date().toLocaleString();

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});


app.get("/api/supervisor/dashboard", async (req, res) => {
  const sh = await getSheets();

  const prod = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
  });

  const rows = (prod.data.values || []).slice(1);

  let running = 0, hold = 0, completed = 0;
  const operators = new Set();

  rows.forEach(r => {
    operators.add(r[3]);
    if (r[5] === "RUNNING") running++;
    if (r[5] === "HOLD") hold++;
    if (r[5] === "COMPLETED") completed++;
  });

  res.json({
    kpi: {
      running,
      hold,
      completed,
      operators: operators.size
    },
    jobs: rows.map(r => ({
      jobId: r[1],
      orderId: r[2],
      operator: r[3],
      machine: r[4],
      status: r[5],
      start: r[6],
      end: r[7],
      holdReason: r[8]
    }))
  });
});

app.get("/api/qc/pending", async (req, res) => {
  const sh = await getSheets();

  const prod = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
  });

  const rows = (prod.data.values || []).slice(1);
  const pending = rows.filter(r => r[5] === "COMPLETED");

  res.json(pending.map(r => ({
    jobId: r[1],
    orderId: r[2],
    operator: r[3],
    machine: r[4],
    completedAt: r[7]
  })));
});


app.post("/api/qc/update", async (req, res) => {
  const { jobId, orderId, result, remarks, checkedBy } = req.body;
  const sh = await getSheets();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "QC!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "QC-" + Date.now(),
        jobId,
        orderId,
        result,
        remarks,
        checkedBy,
        new Date().toLocaleString()
      ]]
    }
  });

  res.json({ success: true });
});


/* ===============================
   START SERVER
================================ */
app.listen(PORT, () => {
  console.log("✅ UPW ERP running at http://localhost:3000");
});

/* ======================================================
   OPERATOR → START PRODUCTION (QR FLOW)
====================================================== */
app.post("/api/production/start", async (req, res) => {
  try {
    const { jobId, machine, operator } = req.body;
    const sh = await getSheets();

    const prodId = "PROD-" + Date.now();
    const now = new Date().toLocaleString();

    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production_Log!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          prodId,
          jobId,
          machine,
          operator,
          "IN_PROGRESS",
          now
        ]]
      }
    });

    res.json({ success: true, prodId });

  } catch (err) {
    console.error("PRODUCTION START ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   OPERATOR – HOLD JOB
================================ */
app.post("/api/operator/hold", async (req, res) => {
  try {
    const { jobId, reason } = req.body;
    if (!reason) return res.json({ success:false });

    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = r.data.values;
    const idx = rows.findIndex(r => r[1] === jobId && r[4] === "RUNNING");

    rows[idx][4] = "HOLD";
    rows[idx][6] = new Date().toLocaleString();
    rows[idx][9] = reason;

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success:true });

  } catch {
    res.status(500).json({ success:false });
  }
});

/* ===============================
   OPERATOR – COMPLETE JOB
================================ */
app.post("/api/operator/complete", async (req, res) => {
  try {
    const { jobId } = req.body;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = r.data.values;
    const idx = rows.findIndex(r => r[1] === jobId);

    rows[idx][4] = "COMPLETED";
    rows[idx][8] = new Date().toLocaleString();

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success:true });

  } catch {
    res.status(500).json({ success:false });
  }
});

app.post("/api/production/start", async (req, res) => {
  try {
    const { jobId, orderId, operator, machine } = req.body;
    const sh = await getSheets();

    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:K",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          jobId,
          orderId,
          operator,
          machine,
          new Date().toLocaleString(), // Start Time
          "", "", "", "", "",
          "RUNNING"
        ]]
      }
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/production/hold", async (req, res) => {
  const { jobId, reason } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId && r[5] === "RUNNING");

  rows[idx][5] = "HOLD";
  rows[idx][9] = reason;

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});


app.post("/api/production/resume", async (req, res) => {
  const { jobId } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId && r[5] === "HOLD");

  rows[idx][5] = "RUNNING";

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});


app.post("/api/production/complete", async (req, res) => {
  const { jobId } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId);

  const start = new Date(rows[idx][6]);
  const end = new Date();

  const totalMinutes = Math.round((end - start) / 60000);

  rows[idx][5] = "COMPLETED";
  rows[idx][7] = end.toISOString();
  rows[idx][8] = totalMinutes;

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true, totalMinutes });
});


/* =========================
   PRODUCTION LIVE DASHBOARD
========================= */
app.get("/api/production/live", async (req, res) => {
  const sh = await getSheets();

  const prod = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production_Log!A:F"

  });

  const rows = (prod.data.values || []).slice(1);

  res.json(rows.map(r => ({
    jobId: r[1],
    machine: r[2],
    operator: r[3],
    status: r[4],
    time: r[5]
  })));
});

/* ===============================
   OPERATOR PERFORMANCE
================================ */
app.get("/api/operator/performance", async (req, res) => {
  try {
    const { operator, month } = req.query;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:I"
    });

    const rows = r.data.values.slice(1);

    let totalJobs = 0;
    let totalWorkMs = 0;
    let totalHoldMs = 0;

    rows.forEach(r => {
      const op = r[2];
      if (op !== operator) return;

      const start = new Date(r[5]);
      const hold = r[6] ? new Date(r[6]) : null;
      const resume = r[7] ? new Date(r[7]) : null;
      const end = r[8] ? new Date(r[8]) : null;

      if (!start || !end) return;

      // Month filter
      if (month && start.getMonth()+1 !== Number(month)) return;

      totalJobs++;

      let workTime = end - start;
      let holdTime = 0;

      if (hold && resume) {
        holdTime = resume - hold;
        workTime -= holdTime;
      }

      totalWorkMs += workTime;
      totalHoldMs += holdTime;
    });

    const hours = ms => (ms / 3600000).toFixed(2);

    res.json({
      jobs: totalJobs,
      workHours: hours(totalWorkMs),
      holdHours: hours(totalHoldMs),
      efficiency:
        totalWorkMs > 0
          ? ((totalWorkMs / (totalWorkMs + totalHoldMs)) * 100).toFixed(1)
          : 0
    });

  } catch (e) {
    res.status(500).json({ success:false });
  }
});

app.get("/api/operator/performance", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = (r.data.values || []).slice(1);

  const summary = {};

  rows.forEach(r => {
    const op = r[3];
    const mins = Number(r[8] || 0);

    if (!summary[op]) {
      summary[op] = { totalMinutes: 0, jobs: 0 };
    }

    summary[op].totalMinutes += mins;
    summary[op].jobs += 1;
  });

  res.json(summary);
});

app.get("/api/qc/pending", async (req, res) => {
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G"
  });

  const rows = (r.data.values || []).slice(1);

  const pending = rows.filter(r => r[5] === "QC_PENDING");

  res.json(pending.map(r => ({
    jobId: r[0],
    orderId: r[1],
    customer: r[2],
    requirement: r[3],
    designer: r[4]
  })));
});

app.post("/api/qc/approve", async (req, res) => {
  const { jobId, remark, checkedBy } = req.body;
  const sh = await getSheets();

  // 1️⃣ Save QC record
  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "QC!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "QC-" + Date.now(),
        jobId,
        "APPROVED",
        remark,
        checkedBy,
        new Date().toLocaleString()
      ]]
    }
  });

  // 2️⃣ Update Job → DELIVERY_READY
  const jobs = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G"
  });

  const rows = jobs.data.values;
  const idx = rows.findIndex(r => r[0] === jobId);

  rows[idx][5] = "DELIVERY_READY";
  rows[idx][6] = new Date().toLocaleString();

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});

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
      reason,
      checkedBy: "Supervisor"
    })
  });

  closeQC();
  loadSupervisor();
  loadQC();
}
app.post("/api/qc/reject", async (req, res) => {
  const { jobId, reason, checkedBy } = req.body;
  const sh = await getSheets();

  // Save QC record
  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "QC!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "QC-" + Date.now(),
        jobId,
        "REJECTED",
        reason,
        checkedBy,
        new Date().toLocaleString()
      ]]
    }
  });

  // Update Job → QC_REJECTED
  const jobs = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G"
  });

  const rows = jobs.data.values;
  const idx = rows.findIndex(r => r[0] === jobId);

  rows[idx][5] = "QC_REJECTED";
  rows[idx][6] = new Date().toLocaleString();

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});

app.get("/health", (req, res) => {
  res.send("UPW ERP Backend Healthy");
});




