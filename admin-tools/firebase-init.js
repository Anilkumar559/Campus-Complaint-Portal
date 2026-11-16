/**
 * Firebase Admin SDK Initialization Module
 * Securely locates and initializes Firebase Admin using Service Account credentials.
 * Credentials are NEVER exposed to the frontend or committed to git.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// University domain validation: exact srmap.edu.in domain
function isStrictSrmapEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  const [username, domain] = parts;
  if (!username || username.length === 0) return false;
  return domain === 'srmap.edu.in';
}

// Locate Firebase Service Account JSON key securely
function findServiceAccountPath() {
  // 1. Check environment variables
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) {
    return path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }

  // 2. Check local admin-tools directory
  const localPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  // 3. Check project root directory
  const rootPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }

  return null;
}

// Initialize Firebase Admin SDK
function initFirebaseAdmin() {
  if (admin.getApps && admin.getApps().length > 0) {
    return { admin, auth: admin.auth() };
  }

  const certPath = findServiceAccountPath();

  if (!certPath) {
    console.error('\n' + '='.repeat(70));
    console.error(' [FIREBASE ADMIN ERROR] Service Account Key Not Found');
    console.error('='.repeat(70));
    console.error('\nTo manage administrator custom claims, the Firebase Admin SDK requires');
    console.error('a private service account key for project "srmap-complaints".\n');
    console.error('HOW TO GET YOUR SERVICE ACCOUNT KEY:');
    console.error('1. Open Firebase Console: https://console.firebase.google.com/');
    console.error('2. Select project: "srmap-complaints"');
    console.error('3. Click the gear icon (⚙️) next to Project Overview > Project settings');
    console.error('4. Navigate to the "Service accounts" tab');
    console.error('5. Click "Generate new private key", then click "Generate key"');
    console.error('6. Save the downloaded JSON file as:');
    console.error(`   ${path.join(__dirname, 'serviceAccountKey.json')}`);
    console.error('\nAlternatively, set the environment variable in PowerShell:');
    console.error('   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\serviceAccountKey.json"');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(certPath, 'utf8'));

    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Service account file is missing required fields (project_id, private_key, or client_email).');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'srmap-complaints'
    });

    return { admin, auth: admin.auth() };
  } catch (err) {
    console.error(`\n[ERROR] Failed to initialize Firebase Admin SDK with "${certPath}":`, err.message);
    process.exit(1);
  }
}

// Synchronize admin email into C++ backend admins.txt files
function syncAdminsFile(action, email) {
  const cleanEmail = email.trim().toLowerCase();
  const filePaths = [
    path.join(__dirname, '..', 'backend', 'admins.txt'),
    path.join(__dirname, '..', 'admins.txt')
  ];

  filePaths.forEach((filePath) => {
    try {
      let list = [];
      if (fs.existsSync(filePath)) {
        list = fs.readFileSync(filePath, 'utf8')
          .split(/\r?\n/)
          .map(l => l.trim().toLowerCase())
          .filter(l => l.length > 0 && !l.startsWith('#'));
      }

      if (action === 'add') {
        if (!list.includes(cleanEmail)) {
          list.push(cleanEmail);
        }
      } else if (action === 'remove') {
        list = list.filter(e => e !== cleanEmail);
      }

      fs.writeFileSync(filePath, list.join('\n') + '\n', 'utf8');
    } catch (e) {
      console.warn(`[WARN] Could not update ${filePath}:`, e.message);
    }
  });
}

function getAdminsFromFile() {
  const filePath = path.join(__dirname, '..', 'backend', 'admins.txt');
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim().toLowerCase())
    .filter(l => l.length > 0 && !l.startsWith('#'));
}

module.exports = {
  initFirebaseAdmin,
  isStrictSrmapEmail,
  syncAdminsFile,
  getAdminsFromFile,
  findServiceAccountPath
};
