const http = require('http');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:8080' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { ...headers }
    };
    if (body) {
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('SRM AP CAMPUS GRIEVANCE PORTAL - FULL INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  // 1. Static Delivery
  const rHome = await request('GET', '/');
  assert(rHome.status === 200 && rHome.body.includes('Campus Care &amp; Grievance Portal'), 'Test 1.1: GET / serves homepage');
  assert(rHome.body.includes('Sign in with Google') && rHome.body.includes('Admin Login'), 'Test 1.2: Both Student and Admin login buttons present');

  const rHead = await request('HEAD', '/');
  assert(rHead.status === 200, 'Test 1.3: HEAD / returns 200 OK for tunnel health checks');

  // 2. Student Google Login with valid @srmap.edu.in
  const rStudentLogin = await request('POST', '/api/login', 'role=student&email=student@srmap.edu.in&name=TestStudent');
  assert(rStudentLogin.status === 200 && rStudentLogin.json && rStudentLogin.json.user.role === 'student', 'Test 2: Student Google Login with student@srmap.edu.in (200 OK)');

  // 3. Admin Google Login (Unauthorized account)
  const rAdminDeny = await request('POST', '/api/login', 'role=admin&email=student@srmap.edu.in&name=TestStudent');
  assert(rAdminDeny.status === 403 && rAdminDeny.json && rAdminDeny.json.error === "Admin access denied. Your account is not authorized as an administrator.", 'Test 3: Unauthorized account student@srmap.edu.in attempting Admin Login returns 403 Forbidden with exact message');

  // 4. Admin Google Login (Authorized account)
  const rAdminOk = await request('POST', '/api/login', 'role=admin&email=admin@srmap.edu.in&name=CampusAdmin');
  assert(rAdminOk.status === 200 && rAdminOk.json && rAdminOk.json.user.role === 'admin', 'Test 4: Authorized account admin@srmap.edu.in accessing Admin Dashboard (200 OK)');

  // 5. Dual Role Same Account
  const rSameAccountStudent = await request('POST', '/api/login', 'role=student&email=admin@srmap.edu.in&name=CampusAdmin');
  assert(rSameAccountStudent.status === 200 && rSameAccountStudent.json && rSameAccountStudent.json.user.role === 'student', 'Test 5: Same Google account (admin@srmap.edu.in) permitted to log into Student Dashboard');

  // 6. Admin Roster Access Control
  const rRosterDenied = await request('GET', '/api/admin/list?adminEmail=student@srmap.edu.in');
  assert(rRosterDenied.status === 403, 'Test 6.1: Non-admin student@srmap.edu.in blocked from viewing admin roster (403)');

  const rRosterAllowed = await request('GET', '/api/admin/list?adminEmail=admin@srmap.edu.in');
  assert(rRosterAllowed.status === 200 && Array.isArray(rRosterAllowed.json.admins), 'Test 6.2: Authorized admin successfully views admin roster');

  // 7. Internal Privilege Grant & Revocation
  const targetTestEmail = 'temp.auditor@srmap.edu.in';
  const rAddAdmin = await request('POST', '/api/admin/add', `adminEmail=admin@srmap.edu.in&targetEmail=${targetTestEmail}`);
  assert(rAddAdmin.status === 200 && rAddAdmin.json.success === true, 'Test 7.1: Authorized admin grants privileges to temp.auditor@srmap.edu.in');

  const rNewAdminCheck = await request('POST', '/api/login', `role=admin&email=${targetTestEmail}`);
  assert(rNewAdminCheck.status === 200 && rNewAdminCheck.json.user.role === 'admin', 'Test 7.2: Newly assigned account now successfully passes Admin Login (200 OK)');

  const rRemoveAdmin = await request('POST', '/api/admin/remove', `adminEmail=admin@srmap.edu.in&targetEmail=${targetTestEmail}`);
  assert(rRemoveAdmin.status === 200 && rRemoveAdmin.json.success === true, 'Test 7.3: Authorized admin revokes privileges from temp.auditor@srmap.edu.in');

  const rRevokedCheck = await request('POST', '/api/login', `role=admin&email=${targetTestEmail}`);
  assert(rRevokedCheck.status === 403, 'Test 7.4: Revoked account is immediately rejected on Admin Login (403)');

  // 8. Student Complaint Submission & Privacy Isolation
  const uniqueMsg = 'Leaking water valve in Room 412 - test ' + Date.now();
  const rSubmit = await request('POST', '/api/complaints', 
    `studentName=PrivacyTester&rollNumber=AP23119999999&studentEmail=privacy.student@srmap.edu.in&roomNumber=Block-B-412&category=Water&description=${encodeURIComponent(uniqueMsg)}`
  );
  assert(rSubmit.status === 201 && rSubmit.json && rSubmit.json.id > 0, 'Test 8.1: Student successfully submits complaint (201 Created)');
  const createdId = rSubmit.json ? rSubmit.json.id : null;

  // Student filtering privacy check
  const rStudentFilter = await request('GET', '/api/complaints?email=privacy.student@srmap.edu.in');
  assert(rStudentFilter.status === 200 && Array.isArray(rStudentFilter.json) && rStudentFilter.json.every(c => c.studentEmail.toLowerCase() === 'privacy.student@srmap.edu.in'), 'Test 8.2: Student complaint query only returns complaints belonging to that student');

  // Another student cannot see this student's complaint
  const rOtherStudent = await request('GET', '/api/complaints?email=otherstudent@srmap.edu.in');
  assert(rOtherStudent.status === 200 && Array.isArray(rOtherStudent.json) && !rOtherStudent.json.some(c => c.id === createdId), 'Test 8.3: Other students cannot see complaints from privacy.student@srmap.edu.in');

  // Admin sees all
  const rAdminAll = await request('GET', '/api/complaints');
  assert(rAdminAll.status === 200 && Array.isArray(rAdminAll.json) && rAdminAll.json.some(c => c.id === createdId), 'Test 8.4: Admin has master access to all campus complaint records');

  // Clean up created complaint
  if (createdId) {
    const rDel = await request('DELETE', `/api/complaints?id=${createdId}&adminEmail=admin@srmap.edu.in`);
    assert(rDel.status === 200, 'Test 8.5: Admin deletes test complaint');
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
