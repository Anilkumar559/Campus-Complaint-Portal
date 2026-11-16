#!/usr/bin/env node
/**
 * assign-admin.js
 * Securely assigns administrator privileges via Firebase Custom Claims to verified @srmap.edu.in users.
 * 
 * Usage:
 *   Interactive: node assign-admin.js
 *   CLI Argument: node assign-admin.js user@srmap.edu.in
 */

const readline = require('readline');
const { initFirebaseAdmin, isStrictSrmapEmail, syncAdminsFile } = require('./firebase-init');

async function promptEmail() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\nEnter university email: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function assignAdmin(targetEmail) {
  const email = targetEmail.trim().toLowerCase();

  // 1. Validate that the email belongs to the exact srmap.edu.in domain
  if (!isStrictSrmapEmail(email)) {
    console.error(`\n[VALIDATION ERROR] "${email}" is not a valid SRM AP university email.`);
    console.error('Only official accounts ending exactly in "@srmap.edu.in" can be assigned administrator privileges.');
    process.exit(1);
  }

  // 2. Initialize Firebase Admin SDK
  const { auth } = initFirebaseAdmin();

  console.log(`\nSearching for user "${email}" in Firebase Authentication...`);

  // 3. Find corresponding Firebase Authentication user
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`\n[ERROR] Account not found: No Firebase Authentication user exists with email "${email}".`);
      console.error('The user must sign in at least once via Google Sign-In with their @srmap.edu.in account first.');
      console.error('Note: Administrator accounts are NOT created automatically.');
    } else {
      console.error(`\n[ERROR] Failed to query user record:`, err.message);
    }
    process.exit(1);
  }

  // 4. Verify that the email is verified
  if (!userRecord.emailVerified) {
    console.error(`\n[ERROR] Account email is not verified: "${email}".`);
    console.error(`Firebase UID: ${userRecord.uid}`);
    console.error('Administrator privileges cannot be granted to unverified accounts.');
    console.error('Please ensure the user verifies their university email before assigning admin privileges.');
    process.exit(1);
  }

  // 5. Retrieve user's Firebase UID and preserve existing custom claims
  const uid = userRecord.uid;
  const existingClaims = userRecord.customClaims || {};

  const updatedClaims = {
    ...existingClaims,
    role: 'admin',
    admin: true
  };

  // 6. Set Firebase Custom Claims
  try {
    await auth.setCustomUserClaims(uid, updatedClaims);

    // 7. Synchronize with C++ backend admins.txt store
    syncAdminsFile('add', email);

    console.log('\n' + '='.repeat(60));
    console.log(' [SUCCESS] ADMINISTRATOR PRIVILEGES ASSIGNED');
    console.log('='.repeat(60));
    console.log(` University Email : ${userRecord.email}`);
    console.log(` Firebase UID     : ${uid}`);
    console.log(` Display Name     : ${userRecord.displayName || '(Not set)'}`);
    console.log(` Email Verified   : ${userRecord.emailVerified ? 'YES' : 'NO'}`);
    console.log(` Custom Claims    : ${JSON.stringify(updatedClaims)}`);
    console.log(` Backend Sync     : Updated backend/admins.txt & admins.txt`);
    console.log('='.repeat(60));
    console.log('\nThe user will receive admin clearance upon their next ID token refresh or sign-in.\n');
  } catch (err) {
    console.error(`\n[ERROR] Failed to set custom claims on user "${uid}":`, err.message);
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

  await assignAdmin(email);
}

main().catch((err) => {
  console.error('\nUnexpected failure:', err);
  process.exit(1);
});
