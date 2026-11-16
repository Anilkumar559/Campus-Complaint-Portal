#!/usr/bin/env node
/**
 * remove-admin.js
 * Securely revokes administrator privileges from a user's Firebase Custom Claims.
 * 
 * Usage:
 *   Interactive: node remove-admin.js
 *   CLI Argument: node remove-admin.js user@srmap.edu.in
 */

const readline = require('readline');
const { initFirebaseAdmin, isStrictSrmapEmail, syncAdminsFile } = require('./firebase-init');

async function promptEmail() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\nEnter university email to revoke admin role: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function removeAdmin(targetEmail) {
  const email = targetEmail.trim().toLowerCase();

  if (!isStrictSrmapEmail(email)) {
    console.error(`\n[VALIDATION ERROR] "${email}" is not a valid SRM AP university email.`);
    process.exit(1);
  }

  const { auth } = initFirebaseAdmin();

  console.log(`\nSearching for user "${email}" in Firebase Authentication...`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`\n[ERROR] Account not found: No Firebase user exists with email "${email}".`);
    } else {
      console.error(`\n[ERROR] Failed to query user record:`, err.message);
    }
    process.exit(1);
  }

  const uid = userRecord.uid;
  const existingClaims = { ...(userRecord.customClaims || {}) };

  // Check if user currently has admin role
  if (existingClaims.role !== 'admin' && !existingClaims.admin) {
    console.log(`\n[INFO] User "${email}" (UID: ${uid}) does not currently have administrator privileges.`);
  }

  // Remove administrator role while preserving unrelated claims
  delete existingClaims.role;
  delete existingClaims.admin;

  try {
    await auth.setCustomUserClaims(uid, Object.keys(existingClaims).length > 0 ? existingClaims : null);

    // Synchronize removal with C++ backend admins.txt store
    syncAdminsFile('remove', email);

    console.log('\n' + '='.repeat(60));
    console.log(' [SUCCESS] ADMINISTRATOR PRIVILEGES REVOKED');
    console.log('='.repeat(60));
    console.log(` University Email : ${userRecord.email}`);
    console.log(` Firebase UID     : ${uid}`);
    console.log(` Remaining Claims : ${JSON.stringify(existingClaims)}`);
    console.log(` Backend Sync     : Removed from backend/admins.txt & admins.txt`);
    console.log('='.repeat(60));
    console.log('\nThe user will immediately be blocked from Admin Dashboard upon next request.\n');
  } catch (err) {
    console.error(`\n[ERROR] Failed to update claims on user "${uid}":`, err.message);
    process.exit(1);
  }
}

async function main() {
  const argEmail = process.argv[2];
  const email = argEmail ? argEmail.trim() : await promptEmail();

  if (!email) {
    console.error('[ERROR] No email provided. Aborting.');
    process.exit(1);
  }

  await removeAdmin(email);
}

main().catch((err) => {
  console.error('\nUnexpected failure:', err);
  process.exit(1);
});
