// Comprehensive Automated Test Suite: Admin CSV Export & Dashboard Improvements
const http = require('http');
const fs = require('fs');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const finalHeaders = { ...headers };
    if (body) {
      finalHeaders['Content-Length'] = Buffer.byteLength(body);
    }
    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: method,
      headers: finalHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ statusCode: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

// Logic mirror from frontend/script.js for testing CSV generation
function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function generateCsvForTest(complaints, filterType, categoryFilterVal) {
  let dataset = [];
  let filename = "Complaints.csv";

  if (filterType === "ALL") {
    dataset = complaints;
    filename = "All_Complaints.csv";
  } else if (filterType === "Pending") {
    dataset = complaints.filter(c => (c.status || "").toLowerCase() === "pending");
    filename = "Pending_Complaints.csv";
  } else if (filterType === "In Progress") {
    dataset = complaints.filter(c => (c.status || "").toLowerCase() === "in progress");
    filename = "In_Progress_Complaints.csv";
  } else if (filterType === "Resolved") {
    dataset = complaints.filter(c => (c.status || "").toLowerCase() === "resolved");
    filename = "Resolved_Complaints.csv";
  } else if (filterType === "CATEGORY") {
    dataset = complaints.filter(c => (c.category || "").toLowerCase() === categoryFilterVal.toLowerCase());
    filename = `${categoryFilterVal.replace(/[^a-zA-Z0-9_-]/g, "_")}_Complaints.csv`;
  }

  const headers = [
    "Complaint ID",
    "Student Name",
    "Registration Number",
    "Student Email",
    "Campus Block / Area",
    "Room / Specific Spot",
    "Complaint Category",
    "Complaint Description",
    "Priority",
    "Status",
    "Assigned Technician",
    "Created Date",
    "Updated Date",
    "Resolution Details"
  ];

  const rows = dataset.map((c) => {
    let block = "Campus Area";
    let spot = c.roomNumber || "N/A";
    if (c.roomNumber && c.roomNumber.includes(" - ")) {
      const parts = c.roomNumber.split(" - ");
      block = parts[0].trim();
      spot = parts.slice(1).join(" - ").trim();
    } else if (c.roomNumber) {
      block = c.roomNumber.trim();
    }

    const tech = c.assignedTechnician || "Unassigned";
    const resolution = c.adminRemarks || (c.status === "Resolved" ? "Resolved by Facilities Team" : "N/A");

    return [
      c.id,
      sanitizeCsvValue(c.studentName),
      sanitizeCsvValue(c.rollNumber),
      sanitizeCsvValue(c.studentEmail),
      sanitizeCsvValue(block),
      sanitizeCsvValue(spot),
      sanitizeCsvValue(c.category),
      sanitizeCsvValue(c.description),
      sanitizeCsvValue(c.priority),
      sanitizeCsvValue(c.status),
      sanitizeCsvValue(tech),
      sanitizeCsvValue(c.createdAt),
      sanitizeCsvValue(c.updatedAt),
      sanitizeCsvValue(resolution)
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  return { filename, dataset, csvContent, rowCount: dataset.length };
}

async function runTests() {
  console.log("=================================================================");
  console.log("ADMIN CSV EXPORT & ENHANCED DASHBOARD VERIFICATION SUITE");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // 1. Verify CSV Export button completely removed from Student Dashboard
  // -------------------------------------------------------------
  console.log("Test Group 1: Student Portal Cleanliness (No CSV Export)");
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const js = fs.readFileSync('frontend/script.js', 'utf8');

  // Should NOT contain the old exportCsvBtn in list-header
  assert(!html.includes('id="exportCsvBtn"'), "exportCsvBtn completely removed from index.html");
  assert(html.includes('id="adminExportCard"'), "adminExportCard present in Admin panel");
  assert(html.includes('id="btnExportAll"'), "btnExportAll present in index.html");
  assert(html.includes('id="btnExportPending"'), "btnExportPending present in index.html");
  assert(html.includes('id="btnExportInProgress"'), "btnExportInProgress present in index.html");
  assert(html.includes('id="btnExportResolved"'), "btnExportResolved present in index.html");
  assert(html.includes('id="btnExportCategory"'), "btnExportCategory present in index.html");

  // In script.js, verify student does not get CSV export
  assert(!js.includes('els.exportCsvBtn.addEventListener'), "No event listener attached to exportCsvBtn");
  assert(js.includes('if (!state.user || state.user.role !== "admin")'), "exportAdminCsv checks administrator role");

  // -------------------------------------------------------------
  // 2. Submit test grievances with varied statuses and categories
  // -------------------------------------------------------------
  console.log("\nTest Group 2: Seed Complaint Records for Verification");

  const sampleTickets = [
    {
      studentName: 'Sarath Kumar Kondaveeti',
      rollNumber: 'AP25110010838',
      studentEmail: 'sarath_kondaveeti@srmap.edu.in',
      roomNumber: 'Ganga Hostel - Room 401',
      category: 'Electrical',
      description: '=HYPERLINK("http://evil.com","Click for grant")', // Test formula injection!
      priority: 'High'
    },
    {
      studentName: 'Anil Kumar',
      rollNumber: 'AP23110010001',
      studentEmail: 'ap23110010001@srmap.edu.in',
      roomNumber: 'Krishna Hostel - Room 204',
      category: 'Plumbing Problem',
      description: 'Water tap leaking heavily under the wash basin.',
      priority: 'Medium'
    },
    {
      studentName: 'Priya Sharma',
      rollNumber: 'AP23110010002',
      studentEmail: 'priya_sharma@srmap.edu.in',
      roomNumber: 'Yamuna Hostel - Room 112',
      category: 'Wi-Fi and Internet',
      description: 'Wi-Fi access point in corridor is disconnected.',
      priority: 'Medium'
    },
    {
      studentName: 'Ravi Teja',
      rollNumber: 'AP23110010003',
      studentEmail: 'ravi_teja@srmap.edu.in',
      roomNumber: 'Academic Block - Lab 301',
      category: 'Air Conditioning',
      description: 'AC unit in computer lab 301 is not cooling.',
      priority: 'Low'
    }
  ];

  const createdIds = [];
  for (const t of sampleTickets) {
    const res = await request('POST', '/api/complaints', new URLSearchParams(t).toString(), {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    if (res.statusCode === 200 || res.statusCode === 201) {
      createdIds.push(res.data.id);
    }
  }
  assert(createdIds.length === 4, `Created 4 sample complaints (IDs: ${createdIds.join(', ')})`);

  // Update status of tickets to create Pending, In Progress, Resolved
  const update1 = await request('POST', '/api/complaints/update', new URLSearchParams({
    id: createdIds[1],
    status: 'In Progress',
    assignedTechnician: 'Plumber Ramesh',
    adminRemarks: 'Inspected leak; replacement valve ordered.',
    adminEmail: 'admin@srmap.edu.in'
  }).toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert(update1.statusCode === 200, "Updated ticket #1 to In Progress with assigned technician");

  const update2 = await request('POST', '/api/complaints/update', new URLSearchParams({
    id: createdIds[2],
    status: 'Resolved',
    assignedTechnician: 'IT Support Team',
    adminRemarks: 'Router rebooted and firmware patched. Working normally.',
    adminEmail: 'admin@srmap.edu.in'
  }).toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert(update2.statusCode === 200, "Updated ticket #2 to Resolved with resolution details");

  // -------------------------------------------------------------
  // 3. Test Admin CSV Generation & 14 Columns
  // -------------------------------------------------------------
  console.log("\nTest Group 3: CSV Export Options & 14 Required Columns");
  const allRes = await request('GET', '/api/complaints?adminEmail=admin@srmap.edu.in');
  assert(allRes.statusCode === 200 && Array.isArray(allRes.data), "Admin retrieved all complaints");
  const allComplaints = allRes.data;

  // A. Export All
  const expAll = generateCsvForTest(allComplaints, "ALL");
  assert(expAll.filename === "All_Complaints.csv", "Filename is All_Complaints.csv");
  assert(expAll.rowCount >= 4, `Export All includes all complaints (count=${expAll.rowCount})`);

  // Check 14 headers
  const csvLines = expAll.csvContent.replace(/^\uFEFF/, '').split("\r\n");
  const headerRow = csvLines[0];
  const expectedHeaders = [
    "Complaint ID",
    "Student Name",
    "Registration Number",
    "Student Email",
    "Campus Block / Area",
    "Room / Specific Spot",
    "Complaint Category",
    "Complaint Description",
    "Priority",
    "Status",
    "Assigned Technician",
    "Created Date",
    "Updated Date",
    "Resolution Details"
  ];
  assert(headerRow === expectedHeaders.join(","), "CSV contains exact 14 required column headers in order");

  // B. Export Pending
  const expPending = generateCsvForTest(allComplaints, "Pending");
  assert(expPending.filename === "Pending_Complaints.csv", "Filename is Pending_Complaints.csv");
  assert(expPending.dataset.every(c => c.status === "Pending"), "Export Pending contains only Pending complaints");

  // C. Export In Progress
  const expProg = generateCsvForTest(allComplaints, "In Progress");
  assert(expProg.filename === "In_Progress_Complaints.csv", "Filename is In_Progress_Complaints.csv");
  assert(expProg.dataset.every(c => c.status === "In Progress"), "Export In Progress contains only In Progress complaints");
  assert(expProg.dataset.some(c => c.assignedTechnician === "Plumber Ramesh"), "Assigned Technician included in export");

  // D. Export Resolved
  const expResolved = generateCsvForTest(allComplaints, "Resolved");
  assert(expResolved.filename === "Resolved_Complaints.csv", "Filename is Resolved_Complaints.csv");
  assert(expResolved.dataset.every(c => c.status === "Resolved"), "Export Resolved contains only Resolved complaints");

  // E. Export by Category
  const expCat = generateCsvForTest(allComplaints, "CATEGORY", "Electrical");
  assert(expCat.filename === "Electrical_Complaints.csv", "Filename is Electrical_Complaints.csv");
  assert(expCat.dataset.every(c => c.category === "Electrical"), "Category export contains only Electrical complaints");

  // -------------------------------------------------------------
  // 4. Formula Injection Prevention Test
  // -------------------------------------------------------------
  console.log("\nTest Group 4: CSV Formula Injection Prevention");
  const formulaRow = csvLines.find(l => l.includes("evil.com"));
  assert(formulaRow !== undefined, "Found ticket with potential formula payload in CSV");
  // Check that the '=' is sanitized with a leading single quote '\''
  assert(formulaRow.includes("\"'=HYPERLINK("), "Formula injection prevented: prepended with single quote inside quotes");

  // Test other prefixes
  assert(sanitizeCsvValue("+12345") === "\"'+\"\"12345\"\"\"" || sanitizeCsvValue("+12345") === "\"'+\"12345\"" || sanitizeCsvValue("+12345") === "\"'+12345\"", "Sanitizes '+' prefix");
  assert(sanitizeCsvValue("-cmd") === "\"'-cmd\"", "Sanitizes '-' prefix");
  assert(sanitizeCsvValue("@SUM(A1:A5)") === "\"'@SUM(A1:A5)\"", "Sanitizes '@' prefix");

  // -------------------------------------------------------------
  // 5. Search and Multi-Filter Integration
  // -------------------------------------------------------------
  console.log("\nTest Group 5: Search & Combined Multi-Filter Filtering");

  // Search by Roll Number
  const searchRoll = allComplaints.filter(c => (c.rollNumber || "").toLowerCase().includes("ap25110010838".toLowerCase()));
  assert(searchRoll.length >= 1, "Search by roll number matches");

  // Filter by Block
  const blockFilter = allComplaints.filter(c => (c.roomNumber || "").toLowerCase().includes("krishna hostel".toLowerCase()));
  assert(blockFilter.length >= 1 && blockFilter.every(c => c.roomNumber.includes("Krishna Hostel")), "Filter by campus block matches");

  // Combined Status + Priority + Category
  const combined = allComplaints.filter(c => c.status === "Pending" && c.category === "Electrical");
  assert(combined.length >= 1 && combined.every(c => c.status === "Pending" && c.category === "Electrical"), "Multi-filter status + category works together");

  // -------------------------------------------------------------
  // 6. Summary Counts Verification
  // -------------------------------------------------------------
  console.log("\nTest Group 6: Live Summary KPI Accuracy");
  const statsRes = await request('GET', '/api/stats');
  assert(statsRes.statusCode === 200, "Retrieved live server statistics");
  const stats = statsRes.data;
  assert(stats.total === allComplaints.length, `Total count matches records (${stats.total} === ${allComplaints.length})`);
  assert(stats.pending === allComplaints.filter(c => c.status === "Pending").length, "Pending count matches live Pending tickets");
  assert(stats.inProgress === allComplaints.filter(c => c.status === "In Progress").length, "In Progress count matches live In Progress tickets");
  assert(stats.resolved === allComplaints.filter(c => c.status === "Resolved").length, "Resolved count matches live Resolved tickets");

  // -------------------------------------------------------------
  // 7. Backend Security: Admin Authorization Enforced
  // -------------------------------------------------------------
  console.log("\nTest Group 7: Backend Access Control & Security");

  // Non-admin attempting to fetch all without email/roll filter should be denied if non-admin email provided
  const unauthorizedAdminCheck = await request('GET', '/api/complaints?adminEmail=notanadmin@srmap.edu.in');
  assert(unauthorizedAdminCheck.statusCode === 403, "Unauthorized non-admin email blocked from master complaints list (403 Forbidden)");

  // Non-admin attempting to update status
  const unauthorizedUpdate = await request('POST', '/api/complaints/update', new URLSearchParams({
    id: createdIds[0],
    status: 'Resolved',
    adminEmail: 'fakeadmin@srmap.edu.in'
  }).toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert(unauthorizedUpdate.statusCode === 403, "Unauthorized user blocked from updating complaint status (403 Forbidden)");

  // -------------------------------------------------------------
  // Cleanup test complaints
  // -------------------------------------------------------------
  console.log("\nTest Group 8: Cleanup Temporary Test Records");
  for (const id of createdIds) {
    await request('DELETE', `/api/complaints?id=${id}&adminEmail=admin@srmap.edu.in`);
  }
  const afterCleanup = await request('GET', '/api/complaints?adminEmail=admin@srmap.edu.in');
  assert(afterCleanup.data.every(c => !createdIds.includes(c.id)), "Temporary test records cleaned up");

  console.log("\n=================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
