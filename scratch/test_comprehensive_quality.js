const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log("================================================================");
  console.log("SRM AP COMPLETE QUALITY & REGRESSION AUDIT SUITE");
  console.log("================================================================\n");

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

  // 1. Health check
  console.log("Test Group 1: Core Server Health & Static Serving");
  try {
    const health = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/api/health',
      method: 'GET'
    });
    assert(health.statusCode === 200, "GET /api/health returns 200 OK");
    const hData = JSON.parse(health.body);
    assert(hData.healthy === true, "Health endpoint reports healthy: true");

    const root = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/',
      method: 'GET'
    });
    assert(root.statusCode === 200, "GET / serves index.html");
    assert(root.body.includes("Campus Care &amp; Grievance Portal") || root.body.includes("Campus Care & Grievance Portal"), "Serves official SRM AP Portal HTML");
  } catch (err) {
    assert(false, `Health check failed: ${err.message}`);
  }

  // 2. Multiline submission sanitization & 3. Duplicate detection
  console.log("\nTest Group 2: Multiline Grievance Textarea Sanitization");
  let testTicketId = null;
  try {
    const postData = new URLSearchParams({
      studentName: 'Sarath Kumar Kondaveeti',
      rollNumber: 'AP25110010838',
      studentEmail: 'sarath_kondaveeti@srmap.edu.in',
      roomNumber: 'Ganga Hostel 301',
      category: 'Electrical',
      description: 'First line of complaint.\r\nSecond line with details.\nThird line with pipe | converted to dash.'
    }).toString();

    const res = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/api/complaints',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    assert(res.statusCode === 201, `Multiline submission returns 201 Created (got ${res.statusCode})`);
    const cData = JSON.parse(res.body);
    testTicketId = cData.id;
    assert(testTicketId > 100, `Grievance ticket registered with valid ID #${testTicketId}`);
    assert(!cData.description.includes('\r') && !cData.description.includes('\n'), "Newline characters stripped safely");
    assert(!cData.description.includes('|'), "Pipe character safely transformed");

    // 3. Duplicate active grievance rejection
    console.log("\nTest Group 3: Duplicate Active Grievance Detection");
    const dupRes = await makeRequest({
      hostname: 'localhost',
      port: 8080,
      path: '/api/complaints',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    assert(dupRes.statusCode === 409, `Duplicate submission rejected with 409 Conflict (got ${dupRes.statusCode})`);
    assert(dupRes.body.includes("identical active grievance"), "Clear error message citing identical active ticket");
  } catch (err) {
    assert(false, `Grievance submission test failed: ${err.message}`);
  } finally {
    if (testTicketId) {
      console.log("\nTest Group 4: Cleanup Test Record");
      try {
        const delData = new URLSearchParams({
          id: String(testTicketId),
          adminEmail: 'admin@srmap.edu.in'
        }).toString();

        const delRes = await makeRequest({
          hostname: 'localhost',
          port: 8080,
          path: '/api/complaints/delete',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(delData)
          }
        }, delData);

        assert(delRes.statusCode === 200, `Cleaned up test ticket #${testTicketId}`);
      } catch (err) {
        assert(false, `Cleanup failed: ${err.message}`);
      }
    }
  }

  // 5. File storage mirroring & integrity
  console.log("\nTest Group 5: File Mirroring and Data Persistence");
  try {
    const rootFile = path.join(__dirname, '..', 'complaints.txt');
    const backendFile = path.join(__dirname, '..', 'backend', 'complaints.txt');
    assert(fs.existsSync(rootFile), "root complaints.txt exists");
    assert(fs.existsSync(backendFile), "backend/complaints.txt exists");

    const rootContent = fs.readFileSync(rootFile, 'utf8').trim();
    const backendContent = fs.readFileSync(backendFile, 'utf8').trim();

    assert(rootContent.length > 0 && rootContent === backendContent, "Root and Backend complaints.txt are perfectly mirrored");
    assert(rootContent.includes("101|Anil Kumar|AP23110010838"), "Pre-existing ticket #101 preserved intact");
    assert(rootContent.includes("106|Divya Sri|AP22110010890"), "Pre-existing ticket #106 preserved intact");
  } catch (err) {
    assert(false, `Mirroring check failed: ${err.message}`);
  }

  // 6. Frontend CSS Media Queries and Accessibility Check
  console.log("\nTest Group 6: Responsive CSS Breakpoint & Accessibility Audit");
  try {
    const cssPath = path.join(__dirname, '..', 'frontend', 'style.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert(css.includes('@media (max-width: 768px)'), "Breakpoint 768px (Tablet) implemented");
    assert(css.includes('@media (max-width: 640px)'), "Breakpoint 640px (Phablet) implemented");
    assert(css.includes('@media (max-width: 414px)'), "Breakpoint 414px (Standard Phone) implemented");
    assert(css.includes('@media (max-width: 360px)'), "Breakpoint 360px/320px (Compact Mobile) implemented");
    assert(css.includes('@media (prefers-reduced-motion: reduce)'), "prefers-reduced-motion accessibility implemented");
    assert(css.includes('font-size: 16px !important'), "Input 16px rule present to prevent iOS Safari auto-zoom");
    assert(css.includes('-webkit-overflow-scrolling: touch'), "Touch scrolling enabled on table container");
  } catch (err) {
    assert(false, `CSS audit failed: ${err.message}`);
  }

  console.log("\n================================================================");
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
