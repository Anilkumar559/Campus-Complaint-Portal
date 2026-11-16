/**
 * Automated Verification Script for SRM AP University Email-Domain Restriction
 * Tests all 7 required cases against C++ Backend and Client Validation Logic.
 */

const http = require('http');

function postLogin(role, email, name = '') {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      role,
      email,
      name,
      provider: 'google'
    }).toString();

    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Client-side domain validator replica
function isStrictSrmapEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  const username = parts[0];
  const domain = parts[1];
  if (!username || username.length === 0) return false;
  return domain === 'srmap.edu.in';
}

async function runTests() {
  console.log('================================================================');
  console.log('SRM AP EMAIL-DOMAIN RESTRICTION & ROLE AUTHORIZATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: student@srmap.edu.in — eligible Student Login
    // -------------------------------------------------------------
    const t1 = await postLogin('student', 'student@srmap.edu.in', 'SRM Student');
    assert(
      t1.status === 200 && t1.data.success === true && t1.data.user.role === 'student',
      'Test 1: student@srmap.edu.in eligible Student Login',
      `Got status ${t1.status}: ${JSON.stringify(t1.data)}`
    );

    // -------------------------------------------------------------
    // Test 2: admin@srmap.edu.in — Admin Login authorized
    // -------------------------------------------------------------
    const t2 = await postLogin('admin', 'admin@srmap.edu.in', 'Campus Administrator');
    assert(
      t2.status === 200 && t2.data.success === true && t2.data.user.role === 'admin',
      'Test 2: admin@srmap.edu.in Admin Login authorized',
      `Got status ${t2.status}: ${JSON.stringify(t2.data)}`
    );

    // -------------------------------------------------------------
    // Test 3: example@gmail.com — rejected for BOTH Student and Admin Login
    // -------------------------------------------------------------
    const t3Student = await postLogin('student', 'example@gmail.com');
    assert(
      t3Student.status === 403 &&
      t3Student.data.error === "Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).",
      'Test 3.1: example@gmail.com rejected for Student Login with exact message',
      `Got status ${t3Student.status}: ${JSON.stringify(t3Student.data)}`
    );

    const t3Admin = await postLogin('admin', 'example@gmail.com');
    assert(
      t3Admin.status === 403 &&
      t3Admin.data.error === "Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).",
      'Test 3.2: example@gmail.com rejected for Admin Login with exact message',
      `Got status ${t3Admin.status}: ${JSON.stringify(t3Admin.data)}`
    );

    // -------------------------------------------------------------
    // Test 4: user@otheruniversity.edu — rejected
    // -------------------------------------------------------------
    const t4 = await postLogin('student', 'user@otheruniversity.edu');
    assert(
      t4.status === 403 &&
      t4.data.error === "Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).",
      'Test 4: user@otheruniversity.edu rejected',
      `Got status ${t4.status}: ${JSON.stringify(t4.data)}`
    );

    // -------------------------------------------------------------
    // Test 5: user@srmap.edu.in.example.com — spoofed subdomain rejected
    // -------------------------------------------------------------
    const t5 = await postLogin('student', 'user@srmap.edu.in.example.com');
    assert(
      t5.status === 403 &&
      t5.data.error === "Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).",
      'Test 5: user@srmap.edu.in.example.com spoofed domain rejected',
      `Got status ${t5.status}: ${JSON.stringify(t5.data)}`
    );

    // -------------------------------------------------------------
    // Test 6: An SRM AP account without admin privileges — rejected from Admin Dashboard
    // -------------------------------------------------------------
    const t6 = await postLogin('admin', 'student@srmap.edu.in');
    assert(
      t6.status === 403 &&
      t6.data.error === "Admin access denied. Your account is not authorized as an administrator.",
      'Test 6: student@srmap.edu.in without admin privileges rejected from Admin Login with exact message',
      `Got status ${t6.status}: ${JSON.stringify(t6.data)}`
    );

    // -------------------------------------------------------------
    // Test 7: The same authorized admin account — can use both login options
    // -------------------------------------------------------------
    const t7Admin = await postLogin('admin', 'admin@srmap.edu.in');
    const t7Student = await postLogin('student', 'admin@srmap.edu.in');
    assert(
      t7Admin.status === 200 && t7Admin.data.user.role === 'admin' &&
      t7Student.status === 200 && t7Student.data.user.role === 'student',
      'Test 7: The same authorized admin account (admin@srmap.edu.in) can use both Student and Admin login',
      `Admin status: ${t7Admin.status}, Student status: ${t7Student.status}`
    );

    // -------------------------------------------------------------
    // Test 8: User sarath_kondaveeti@srmap.edu.in (UID: WLPq857bHeProM99BVez3ZbNYz22)
    // -------------------------------------------------------------
    const t8Admin = await postLogin('admin', 'sarath_kondaveeti@srmap.edu.in', 'Sarath Kondaveeti');
    assert(
      t8Admin.status === 200 && t8Admin.data.success === true && t8Admin.data.user.role === 'admin',
      'Test 8.1: sarath_kondaveeti@srmap.edu.in authorized as Administrator (200 OK)',
      `Got status ${t8Admin.status}: ${JSON.stringify(t8Admin.data)}`
    );

    const t8Student = await postLogin('student', 'sarath_kondaveeti@srmap.edu.in', 'Sarath Kondaveeti');
    assert(
      t8Student.status === 200 && t8Student.data.success === true && t8Student.data.user.role === 'student',
      'Test 8.2: sarath_kondaveeti@srmap.edu.in can also access Student Dashboard (200 OK)',
      `Got status ${t8Student.status}: ${JSON.stringify(t8Student.data)}`
    );

    // -------------------------------------------------------------
    // Additional Security Unit Tests: Client Regex & Sanitizer
    // -------------------------------------------------------------
    assert(!isStrictSrmapEmail('example@gmail.com'), 'Client Validation: example@gmail.com rejected');
    assert(!isStrictSrmapEmail('user@otheruniversity.edu'), 'Client Validation: other university domain rejected');
    assert(!isStrictSrmapEmail('user@srmap.edu.in.example.com'), 'Client Validation: sub-domain spoof rejected');
    assert(!isStrictSrmapEmail('user@fake.srmap.edu.in'), 'Client Validation: unauthorized subdomain rejected');
    assert(!isStrictSrmapEmail('@srmap.edu.in'), 'Client Validation: empty user rejected');
    assert(isStrictSrmapEmail('STUDENT@SRMAP.EDU.IN'), 'Client Validation: case-insensitive uppercase accepted');
    assert(isStrictSrmapEmail('ap23110010838@srmap.edu.in'), 'Client Validation: valid student ID accepted');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
