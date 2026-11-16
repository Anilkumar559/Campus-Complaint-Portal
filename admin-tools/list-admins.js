#!/usr/bin/env node
/**
 * list-admins.js
 * Lists all users with the Firebase administrator Custom Claim (`role: "admin"`).
 * Queries Firebase Authentication records with pagination support and displays backend sync status.
 * 
 * Usage:
 *   node list-admins.js
 */

const { initFirebaseAdmin, getAdminsFromFile } = require('./firebase-init');

async function listAdmins() {
  const { auth } = initFirebaseAdmin();

  console.log('\n' + '='.repeat(75));
  console.log(' SRM UNIVERSITY-AP: FIREBASE ADMINISTRATOR DIRECTORY');
  console.log('='.repeat(75));

  const adminUsers = [];
  const backendAdmins = getAdminsFromFile();
  let nextPageToken = undefined;
  let totalScanned = 0;

  try {
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      totalScanned += listUsersResult.users.length;

      for (const user of listUsersResult.users) {
        const claims = user.customClaims || {};
        if (claims.role === 'admin' || claims.admin === true) {
          adminUsers.push({
            name: user.displayName || '(No Display Name)',
            email: user.email,
            uid: user.uid,
            verified: user.emailVerified,
            claims: JSON.stringify(claims),
            backendSync: backendAdmins.includes((user.email || '').toLowerCase()) ? 'Active' : 'Missing in admins.txt'
          });
        }
      }

      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`Scanned ${totalScanned} Firebase Authentication account(s).\n`);

    if (adminUsers.length === 0) {
      console.log('No users with administrator Custom Claims were found in Firebase Auth.');
      console.log('\nTo assign an administrator, run:');
      console.log('  node assign-admin.js <user@srmap.edu.in>\n');
    } else {
      console.log(`Found ${adminUsers.length} assigned administrator(s):\n`);
      console.table(adminUsers);
    }

    console.log('-'.repeat(75));
    console.log(`C++ Backend (admins.txt) authorized roster:`);
    backendAdmins.forEach((email, i) => console.log(`  ${i + 1}. ${email}`));
    console.log('='.repeat(75) + '\n');
  } catch (err) {
    console.error('[ERROR] Failed to list users from Firebase Authentication:', err.message);
    process.exit(1);
  }
}

listAdmins().catch((err) => {
  console.error('\nUnexpected failure:', err);
  process.exit(1);
});
