// Automated Test Suite for Student Identity Extraction & Form Protection
// Tests the exact specifications requested for Sarath Kumar Kondaveeti | AP25110010838

const http = require('http');

// Helper to simulate the exact extraction function in frontend/script.js
function extractStudentIdentityFromProfile(displayName) {
  if (!displayName || typeof displayName !== "string") {
    return { name: "", rollNumber: "", valid: false };
  }

  const separatorIndex = displayName.indexOf("|");
  if (separatorIndex === -1) {
    return { name: displayName.trim(), rollNumber: "", valid: false };
  }

  const name = displayName.substring(0, separatorIndex).trim();
  const rollNumber = displayName.substring(separatorIndex + 1).trim();

  if (!name || !rollNumber) {
    return { name, rollNumber, valid: false };
  }

  return { name, rollNumber, valid: true };
}

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

async function runTests() {
  console.log("===============================================================");
  console.log("TESTING STUDENT IDENTITY EXTRACTION & REGISTER GRIEVANCE FORM");
  console.log("===============================================================\n");

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
  // Test 1: Extraction with Sarath Kumar Kondaveeti | AP25110010838
  // -------------------------------------------------------------
  console.log("Test Group 1: Profile Display Name Extraction");
  const sample1 = "Sarath Kumar Kondaveeti | AP25110010838";
  const res1 = extractStudentIdentityFromProfile(sample1);
  assert(res1.valid === true, "Valid format recognized");
  assert(res1.name === "Sarath Kumar Kondaveeti", `Name extracted before '|': expected 'Sarath Kumar Kondaveeti', got '${res1.name}'`);
  assert(res1.rollNumber === "AP25110010838", `Roll extracted after '|': expected 'AP25110010838', got '${res1.rollNumber}'`);
  assert(!res1.name.includes("|") && !res1.name.includes("AP25110010838"), "Student Name does NOT contain roll or pipe");

  // -------------------------------------------------------------
  // Test 2: Spaces and whitespace trimming
  // -------------------------------------------------------------
  const sample2 = "   Kondaveeti Sarath   |   AP25110010838   ";
  const res2 = extractStudentIdentityFromProfile(sample2);
  assert(res2.name === "Kondaveeti Sarath", "Whitespace trimmed from name");
  assert(res2.rollNumber === "AP25110010838", "Whitespace trimmed from rollNumber");

  // -------------------------------------------------------------
  // Test 3: Missing separator does NOT invent missing information
  // -------------------------------------------------------------
  console.log("\nTest Group 2: Incomplete Google Profile (Missing Separator)");
  const sample3 = "Sarath Kumar Kondaveeti";
  const res3 = extractStudentIdentityFromProfile(sample3);
  assert(res3.valid === false, "Missing '|' marked as invalid");
  assert(res3.rollNumber === "", "Does not invent roll number");

  const sample4 = "";
  const res4 = extractStudentIdentityFromProfile(sample4);
  assert(res4.valid === false, "Empty display name marked as invalid");

  // -------------------------------------------------------------
  // Test 4: Frontend HTML Inspection
  // -------------------------------------------------------------
  console.log("\nTest Group 3: Frontend HTML Non-Editable Attributes");
  const fs = require('fs');
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert(html.includes('id="studentName"') && html.includes('readonly'), "studentName input has readonly attribute in HTML");
  assert(html.includes('id="rollNumber"') && html.includes('readonly'), "rollNumber input has readonly attribute in HTML");
  assert(html.includes('id="studentEmail"') && html.includes('readonly'), "studentEmail input has readonly attribute in HTML");
  assert(!html.includes('id="studentName" name="studentName" disabled'), "studentName is NOT disabled (uses readonly)");
  assert(html.includes('id="studentProfileNotice"'), "studentProfileNotice banner is present in HTML");

  // -------------------------------------------------------------
  // Test 5: Frontend CSS Inspection
  // -------------------------------------------------------------
  console.log("\nTest Group 4: Frontend CSS for Readonly Inputs");
  const css = fs.readFileSync('frontend/style.css', 'utf8');
  assert(css.includes('input[readonly]'), "input[readonly] style rule exists");
  assert(css.includes('cursor: default;'), "input[readonly] has default cursor");

  // -------------------------------------------------------------
  // Test 6: Backend Login API with Sarath Kumar Kondaveeti | AP25110010838
  // -------------------------------------------------------------
  console.log("\nTest Group 5: Backend Login Endpoint with Formatted Name");
  const loginBody = new URLSearchParams({
    role: 'student',
    email: 'sarath_kondaveeti@srmap.edu.in',
    name: 'Sarath Kumar Kondaveeti | AP25110010838',
    rollNumber: ''
  }).toString();

  const loginRes = await request('POST', '/api/login', loginBody, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  assert(loginRes.statusCode === 200, `Login returns 200 OK (status=${loginRes.statusCode})`);
  assert(loginRes.data.user.name === "Sarath Kumar Kondaveeti", `Backend separated user.name: '${loginRes.data.user.name}'`);
  assert(loginRes.data.user.rollNumber === "AP25110010838", `Backend extracted user.rollNumber: '${loginRes.data.user.rollNumber}'`);
  assert(loginRes.data.user.email === "sarath_kondaveeti@srmap.edu.in", `Backend preserved email: '${loginRes.data.user.email}'`);

  // -------------------------------------------------------------
  // Test 7: Backend Complaint Submission with Separated Fields
  // -------------------------------------------------------------
  console.log("\nTest Group 6: Backend Complaint Submission Verification");
  const complaintBody = new URLSearchParams({
    studentName: 'Sarath Kumar Kondaveeti',
    rollNumber: 'AP25110010838',
    studentEmail: 'sarath_kondaveeti@srmap.edu.in',
    roomNumber: 'Ganga Hostel - Room 312',
    category: 'Electrical',
    description: 'Study lamp socket in Room 312 is not delivering power.',
    priority: 'Medium'
  }).toString();

  const complaintRes = await request('POST', '/api/complaints', complaintBody, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  assert(complaintRes.statusCode === 200 || complaintRes.statusCode === 201, `Submission returns 200/201 OK (status=${complaintRes.statusCode})`);
  assert(complaintRes.data.id > 0, `Grievance ticket created with ID: #${complaintRes.data.id}`);
  assert(complaintRes.data.studentName === "Sarath Kumar Kondaveeti", "Submitted studentName verified");
  assert(complaintRes.data.rollNumber === "AP25110010838", "Submitted rollNumber verified");
  assert(complaintRes.data.studentEmail === "sarath_kondaveeti@srmap.edu.in", "Submitted studentEmail verified");

  // -------------------------------------------------------------
  // Test 8: Backend Rejects Pipe Character in Individual Fields
  // -------------------------------------------------------------
  console.log("\nTest Group 7: Backend Security - Rejecting Unparsed Pipe Characters");
  const badComplaintBody = new URLSearchParams({
    studentName: 'Sarath Kumar Kondaveeti | AP25110010838', // Unseparated!
    rollNumber: 'AP25110010838',
    studentEmail: 'sarath_kondaveeti@srmap.edu.in',
    roomNumber: 'Ganga Hostel - Room 312',
    category: 'Electrical',
    description: 'Test complaint with pipe in name',
    priority: 'Medium'
  }).toString();

  const badRes = await request('POST', '/api/complaints', badComplaintBody, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  assert(badRes.statusCode === 400, `Backend properly rejects submission with unseparated pipe (status=${badRes.statusCode})`);
  assert(badRes.data.error.includes("separated") || badRes.data.error.includes("not allowed") || badRes.data.error.includes("Do not use '|'"), "Informative error message returned");

  // -------------------------------------------------------------
  // Test 9: Privacy Filtering for Student's Own Complaints
  // -------------------------------------------------------------
  console.log("\nTest Group 8: Privacy Filtering by Email / Roll Number");
  const studentListRes = await request('GET', '/api/complaints?email=sarath_kondaveeti@srmap.edu.in');
  assert(studentListRes.statusCode === 200, "Student grievances retrieved");
  assert(Array.isArray(studentListRes.data), "Returns array of complaints");
  assert(studentListRes.data.length >= 1, "Student sees their own registered complaint");
  const allMatch = studentListRes.data.every(c => c.studentEmail === 'sarath_kondaveeti@srmap.edu.in');
  assert(allMatch, "All returned complaints belong to the authenticated student");

  // Cleanup created test complaint
  if (complaintRes.data && complaintRes.data.id) {
    const delBody = new URLSearchParams({
      id: String(complaintRes.data.id),
      adminEmail: 'admin@srmap.edu.in'
    }).toString();
    await request('POST', '/api/complaints/delete', delBody, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
  }

  console.log("\n===============================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("===============================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
