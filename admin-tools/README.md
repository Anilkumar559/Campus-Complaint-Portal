# SRM University-AP: Administrator Assignment System & Admin Tools

This directory contains secure, isolated Node.js tools powered by the **Firebase Admin SDK** to assign, remove, and audit administrator Custom Claims (`{ role: "admin" }`) for verified `@srmap.edu.in` accounts.

---

## 1. Prerequisites & Node.js Setup

### 1.1 Verify or Install Node.js
Ensure Node.js (v18+ recommended, v24+ verified) is installed on your Windows machine:

```powershell
node -v
npm -v
```

If Node.js is not installed:
- Download the official installer from [nodejs.org](https://nodejs.org/).
- Or install via Windows Package Manager:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

---

## 2. Directory Initialization & Firebase Admin SDK

The `admin-tools` directory is already initialized with its own dedicated `package.json` and dependencies.

To verify or reinstall dependencies:

```powershell
Set-Location "c:\Users\anilk\Desktop\CampusComplaintSystem\admin-tools"
npm install
```

Installed packages:
- `firebase-admin` (v13+)

---

## 3. Firebase Service Account Configuration

The Firebase Admin SDK requires private service account credentials to set custom user claims on Firebase Authentication.

### 3.1 How to Download Your Service Account Key
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **`srmap-complaints`**.
3. Click the gear icon (**⚙️**) next to *Project Overview* in the left sidebar and select **Project settings**.
4. Switch to the **Service accounts** tab.
5. Click **Generate new private key**, then confirm by clicking **Generate key**.
6. A JSON file will download to your computer.

### 3.2 Securely Storing the Key
Save the downloaded JSON file into `admin-tools` named **`serviceAccountKey.json`**:

```text
admin-tools/
    serviceAccountKey.json   <-- (Auto-ignored by .gitignore, NEVER commit to git)
```

### 3.3 Or Set via Environment Variable
Alternatively, point to your service account key from anywhere:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\anilk\Downloads\serviceAccountKey.json"
```

> [!CAUTION]
> Service account keys contain full administrative power over your Firebase project.
> - Never commit `serviceAccountKey.json` to GitHub.
> - Never reference or bundle service account credentials into frontend files.
> - Both `.gitignore` and `admin-tools/.gitignore` are pre-configured to block private keys.

---

## 4. Administrator Management Commands

All commands are executed from PowerShell inside `admin-tools`.

### 4.1 Assign Administrator Privileges (`assign-admin.js`)

Assigns `{ role: "admin", admin: true }` Custom Claims to a verified `@srmap.edu.in` account and synchronizes with the C++ backend:

#### Command Line Syntax:
```powershell
Set-Location "c:\Users\anilk\Desktop\CampusComplaintSystem\admin-tools"
node assign-admin.js sarath_kondaveeti@srmap.edu.in
```

#### Interactive Syntax:
```powershell
node assign-admin.js
# When prompted:
# Enter university email: sarath_kondaveeti@srmap.edu.in
```

#### Validation & Security Behavior:
1. Validates that the email strictly matches `username@srmap.edu.in` (rejects Gmail, external domains, and subdomains).
2. Looks up the Firebase Authentication user record.
3. Checks `emailVerified == true` (unverified accounts are rejected).
4. Sets the Firebase Custom Claim `{ role: "admin", admin: true }`.
5. Updates `backend/admins.txt` and `admins.txt` to keep the C++ backend in sync.

---

### 4.2 Remove Administrator Privileges (`remove-admin.js`)

Revokes administrator Custom Claims while preserving other claims:

#### Command Line Syntax:
```powershell
Set-Location "c:\Users\anilk\Desktop\CampusComplaintSystem\admin-tools"
node remove-admin.js user@srmap.edu.in
```

#### Interactive Syntax:
```powershell
node remove-admin.js
# When prompted:
# Enter university email to revoke admin role: user@srmap.edu.in
```

---

### 4.3 List All Administrators (`list-admins.js`)

Scans all Firebase Authentication user accounts, paginates through records, and prints a formatted table of all users holding the administrator claim:

```powershell
Set-Location "c:\Users\anilk\Desktop\CampusComplaintSystem\admin-tools"
node list-admins.js
```

#### Output Fields:
- **Name**: User display name
- **Email**: Official `@srmap.edu.in` email
- **UID**: Firebase User ID (e.g. `WLPq857bHeProM99BVez3ZbNYz22`)
- **Verified**: Email verification status
- **Claims**: Active custom claims JSON
- **Backend Sync**: Synchronization status with C++ `admins.txt`

---

## 5. Security Architecture Overview

```
                      [ User Browser ]
                             │
            Google OAuth (@srmap.edu.in only)
                             │
                             ▼
                 [ Firebase Authentication ]
                   Custom Claim: { role: "admin" }
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
      [ Frontend script.js ]     [ C++ Backend (8080) ]
       - Validates @srmap.edu.in  - Server-side admins.txt store
       - Checks token claim       - JWT token payload inspector
       - Routes Student vs Admin  - Restricts ticket actions
                                  - Protected /api/admin/ endpoints
```

1. **Defense-in-Depth**:
   - Client validates domain (`@srmap.edu.in`) and requests fresh ID token.
   - C++ backend checks its authorized `admins.txt` store AND verifies incoming Firebase ID tokens.
   - Firestore Security Rules enforce `request.auth.token.role == "admin" || request.auth.token.admin == true`.
2. **Zero-Trust Client**:
   - Frontend state or `localStorage` can never grant admin access.
   - If an unauthorized student accesses `#dashboardSection` directly, the C++ backend returns HTTP 403 Forbidden on any admin endpoint.
3. **Internal Assignment Only**:
   - There is no public registration for admins.
   - Privileges are granted solely by running `assign-admin.js` with Firebase Service Account clearance.
