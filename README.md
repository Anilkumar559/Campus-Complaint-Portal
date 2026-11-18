# SRM University-AP — Campus Care & Grievance Portal

A high-performance **C++17** backend server and modern, mobile-responsive web frontend engineered specifically for **SRM University-AP, Andhra Pradesh** (`@srmap.edu.in`).

The portal provides an intuitive Single Sign-On (SSO) login experience for **Students** and **Campus Facility Administrators / Wardens**, featuring Firebase Google Authentication with strict university domain enforcement, real-time grievance submission with automatic name/roll separation, automated priority determination, campus location mapping across SRM AP hostel and academic blocks, student privacy isolation, live status tracking, maintenance remarks, and professional 14-column CSV audit reporting with formula injection protection.

---

## 🏛️ University Branding & System Specifications

- **Institution**: SRM University-AP, Andhra Pradesh (Neerukonda, Amaravati – 522 240)
- **Official Domain Restriction**: Only Google accounts ending in `@srmap.edu.in` can authenticate.
- **Backend Architecture**: Native C++17 HTTP/1.1 multi-threaded socket server using Windows Winsock2 (`ws2_32`).
- **Data Persistence**: Two-way synchronized pipe-delimited flat-file storage (`complaints.txt` and `backend/complaints.txt`).
- **Frontend Stack**: Pure semantic HTML5, CSS3 with responsive viewport breakpoints (320px to 4K desktop), and vanilla JavaScript (no heavy runtime framework dependencies).
- **Default Port**: `8080` (accessible at `http://localhost:8080/` or via VS Code Dev Tunnels).

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Build & Run Instructions](#-build--run-instructions)
   - [Method 1: One-Click Quick Start (Recommended)](#method-1-one-click-quick-start-recommended)
   - [Method 2: Manual PowerShell Build](#method-2-manual-powershell-build)
   - [Method 3: Manual Command Prompt Build](#method-3-manual-command-prompt-build)
   - [Method 4: Command-Line Interface (CLI) Tool](#method-4-command-line-interface-cli-tool)
3. [Configuration Files](#-configuration-files)
   - [Firebase Client Configuration (`frontend/firebase-config.js`)](#1-firebase-client-configuration-frontendfirebase-configjs)
   - [Administrator Roster (`admins.txt`)](#2-administrator-roster-adminstxt)
   - [Firebase Admin SDK Tools (`admin-tools/`)](#3-firebase-admin-sdk-tools-admin-tools)
   - [Firestore Security Rules (`firestore.rules`)](#4-firestore-security-rules-firestorerules)
4. [Datasets & Data Storage (`complaints.txt`)](#-datasets--data-storage-complaintstxt)
   - [Record Schema (13 Pipe-Delimited Fields)](#record-schema-13-pipe-delimited-fields)
   - [Pre-Seeded Sample Grievance Records](#pre-seeded-sample-grievance-records)
   - [Duplicate Grievance Prevention & Sanitization](#duplicate-grievance-prevention--sanitization)
5. [Administrator Assignment & Privilege Management](#-administrator-assignment--privilege-management)
6. [REST API Reference](#-rest-api-reference)
7. [Automated Testing & Verification](#-automated-testing--verification)

---

## 💻 Prerequisites

Ensure the following tools are installed on your system:

| Tool | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **MinGW-w64 / GCC (`g++`)** | C++17 support | Compiles `complaint_server.exe` and `complaint_cli.exe`. Must be available in system `PATH` (or at `C:\MinGW\bin`). |
| **Windows OS** | Windows 10 / 11 | Supported environment with PowerShell or Command Prompt. |
| **Node.js & npm** *(Optional)* | Node.js v16+ | Required only for the Firebase Admin SDK assignment tools (`admin-tools/`) and automated test suites in `scratch/`. |
| **Modern Web Browser** | Chrome, Edge, Safari, Firefox | Supports Google Sign-In and responsive layouts. |

To verify your C++ compiler in PowerShell or Command Prompt:
```powershell
g++ --version
```

---

## 🚀 Build & Run Instructions

### Method 1: One-Click Quick Start (Recommended)

Run the included automated batch build script from the project root:

```bat
build_and_run.bat
```

This script will automatically:
1. Terminate any running `complaint_server.exe` instances to release Windows file locks.
2. Compile both `complaint_server.exe` and `complaint_cli.exe` using `g++` with `-std=c++17 -O2`.
3. Copy the compiled binaries to the root directory.
4. Launch the web server on **`http://localhost:8080/`**.

---

### Method 2: Manual PowerShell Build

If building manually in Windows PowerShell, stop any running instance first to avoid `Copy-Item` file lock errors:

```powershell
# 1. Stop any active server instance to release the binary file lock
Stop-Process -Name complaint_server -Force -ErrorAction SilentlyContinue

# 2. Navigate to the backend directory
cd c:\Users\anilk\Desktop\CampusComplaintSystem\backend

# 3. Compile the C++ backend server
g++ -std=c++17 -O2 server.cpp ComplaintManager.cpp -lws2_32 -o complaint_server.exe

# 4. Copy the compiled binary to the root directory with -Force
Copy-Item complaint_server.exe ..\complaint_server.exe -Force

# 5. Return to the root folder and run
cd ..
.\complaint_server.exe
```

---

### Method 3: Manual Command Prompt Build

In standard Windows Command Prompt (`cmd.exe`):

```cmd
:: 1. Terminate any running instance
taskkill /F /IM complaint_server.exe >nul 2>&1

:: 2. Compile in backend folder
cd backend
g++ -std=c++17 -O2 server.cpp ComplaintManager.cpp -lws2_32 -o complaint_server.exe

:: 3. Copy to root directory
copy /y complaint_server.exe ..\complaint_server.exe

:: 4. Return to root & launch
cd ..
complaint_server.exe
```

---

### Method 4: Command-Line Interface (CLI) Tool

You can also inspect, add, and resolve complaints directly from the terminal without opening a web browser:

```powershell
# Compile the CLI tool (if not already compiled)
cd backend
g++ -std=c++17 -O2 cli_main.cpp ComplaintManager.cpp -o complaint_cli.exe
Copy-Item complaint_cli.exe ..\complaint_cli.exe -Force
cd ..

# Launch the interactive CLI
.\complaint_cli.exe
```

**CLI Capabilities**:
- Register new grievances with automatic priority calculation.
- Display all tickets with timestamps, statuses, and maintenance remarks.
- Search grievances by Ticket ID.
- Update ticket status (`Pending`, `In Progress`, `Resolved`) and assign technicians.
- Delete individual complaint records.
- View real-time campus facility KPI statistics.

---

## ⚙️ Configuration Files

### 1. Firebase Client Configuration (`frontend/firebase-config.js`)
Configures the Firebase Web SDK (v10 compat) for client-side Google Authentication.

```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "srmap-complaints.firebaseapp.com",
  projectId: "srmap-complaints",
  storageBucket: "srmap-complaints.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

> **Authorized Domains**: When deploying or testing via Dev Tunnels (e.g., `https://2gscpknn-8080.inc1.devtunnels.ms/`), add the domain in **Firebase Console → Authentication → Settings → Authorized domains**.

### 2. Administrator Roster (`admins.txt`)
Located in both project root and `backend/admins.txt` (automatically mirrored by the server). Stores one authorized administrator email per line:

```text
ap23110010838@srmap.edu.in
admin@srmap.edu.in
estate.admin@srmap.edu.in
sarath_kondaveeti@srmap.edu.in
```

- Only accounts listed here (or possessing verified Firebase Admin custom claims) can access the Admin Dashboard, modify ticket statuses, assign technicians, or export CSV audit records.
- All other `@srmap.edu.in` accounts attempting Admin Login are rejected with `403 Forbidden`.

### 3. Firebase Admin SDK Tools (`admin-tools/`)
A dedicated Node.js utility folder for server-side administrator role management using Firebase Custom Claims:

```text
admin-tools/
    ├── package.json
    ├── firebase-init.js     # Loads credentials from service-account JSON or env
    ├── assign-admin.js      # Grants { admin: true } custom claim
    ├── remove-admin.js      # Revokes admin custom claim
    ├── list-admins.js       # Queries all users with admin privileges
    ├── .gitignore           # Prevents committing service-account keys
    └── README.md            # Detailed Admin SDK instructions
```

**Setup**:
1. Place your Firebase service account private key JSON file in `admin-tools/` (or set `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable).
2. Install dependencies:
   ```powershell
   cd admin-tools
   npm install
   ```

### 4. Firestore Security Rules (`firestore.rules`)
Defines security rules restricting read and write operations based on authenticated Google UID and university domain claims.

---

## 🗄️ Datasets & Data Storage (`complaints.txt`)

Data persistence is managed via pipe-delimited text records stored in `complaints.txt` (root) and mirrored in `backend/complaints.txt`.

### Record Schema (13 Pipe-Delimited Fields)

```text
ID | StudentName | RollNumber | Location/Room | Category | Priority | Status | Description | CreatedAt | UpdatedAt | StudentEmail | AdminRemarks | AssignedTechnician
```

| Field Index | Name | Example Value | Description |
| :---: | :--- | :--- | :--- |
| `0` | **Ticket ID** | `101` | Sequential integer ticket identifier ($\ge 101$). |
| `1` | **Student Name** | `Anil Kumar` | Extracted full name of the student. |
| `2` | **Roll Number** | `AP23110010838` | Extracted SRM AP student registration number. |
| `3` | **Location / Room** | `Ganga Hostel 412` | Combined hostel/academic block and room/lab number. |
| `4` | **Category** | `Wi-Fi and Internet` | Grievance department / category. |
| `5` | **Priority** | `Medium` | `High`, `Medium`, or `Low` (auto-assigned by keyword rule engine). |
| `6` | **Status** | `Resolved` | `Pending`, `In Progress`, or `Resolved`. |
| `7` | **Description** | `Wi-Fi drops in 4th floor wing B.` | Sanitized problem description (line breaks normalized to single spaces). |
| `8` | **Created At** | `2026-11-14 09:15:20` | Timestamp of ticket submission (`YYYY-MM-DD HH:MM:SS`). |
| `9` | **Updated At** | `2026-11-14 14:30:10` | Timestamp of last status or remark update. |
| `10` | **Student Email** | `ap23110010838@srmap.edu.in` | Authenticated `@srmap.edu.in` email. |
| `11` | **Admin Remarks** | `AP-G4-02 rebooted by IT team.` | Notes added by facility managers or wardens. |
| `12` | **Assigned Technician** | `Maheswar (Plumbing)` | Name / department of the technician assigned to the ticket. |

> **Backward Compatibility**: `ComplaintManager.cpp` transparently parses legacy 6, 8, 10, and 12-field records and automatically migrates them to the canonical 13-field format upon next save.

### Pre-Seeded Sample Grievance Records

The application comes pre-loaded with realistic campus grievance data in [complaints.txt](file:///c:/Users/anilk/Desktop/CampusComplaintSystem/complaints.txt):

1. **Ticket #101**: Anil Kumar (`AP23110010838`) — *Ganga Hostel 412* | Category: Wi-Fi and Internet | Status: **Resolved**
2. **Ticket #102**: Priya Sharma (`AP23110010142`) — *Yamuna Hostel 208* | Category: Plumbing Problem | Status: **In Progress**
3. **Ticket #103**: Rahul Varma (`AP22110010319`) — *Neerukonda Academic Block 302* | Category: Classroom & Lab | Status: **In Progress**
4. **Ticket #104**: Sneha Reddy (`AP24110010055`) — *Main Mess Dining Hall 1* | Category: Hostel & Mess | Status: **Pending**
5. **Ticket #105**: Karthik Naidu (`AP23110010512`) — *Krishna Hostel 105* | Category: Electrical | Status: **Pending**
6. **Ticket #106**: Divya Sri (`AP22110010890`) — *Central Library 2nd Floor* | Category: Cleanliness & Hygiene | Status: **Resolved**

### Duplicate Grievance Prevention & Sanitization

- **Duplicate Detection**: `ComplaintManager::add()` rejects duplicate submissions if an active (non-resolved) grievance with matching email, category, location, and description already exists, returning `409 Conflict`.
- **Multiline Sanitization**: Input text containing `\r` and `\n` is automatically normalized to single spaces so textareas do not break pipe-delimited file lines. Any literal `|` characters in text inputs are safely converted to `-`.

---

## 👥 Administrator Assignment & Privilege Management

Administrators can be assigned or revoked using any of the three following methods:

### Option A: Via the Web Admin Dashboard (UI)
1. Sign in with an existing authorized administrator account via **Admin Login**.
2. Navigate to the **Administrator Roster** card in the Admin Workspace.
3. Enter the target `@srmap.edu.in` email and click **Grant Admin Privileges**.
4. To remove an administrator, click the **Revoke** button next to their email.

### Option B: Via the Batch Utility Script
From the project root:

```cmd
:: List all current administrators
manage_admins.bat list

:: Add a new administrator
manage_admins.bat add new.admin@srmap.edu.in

:: Revoke administrator privileges
manage_admins.bat remove old.admin@srmap.edu.in
```

### Option C: Via Node.js Firebase Admin SDK Tools
```powershell
cd admin-tools

# List all current admins
node list-admins.js

# Assign administrator claim
node assign-admin.js sarath_kondaveeti@srmap.edu.in

# Revoke administrator claim
node remove-admin.js temp.admin@srmap.edu.in
```

---

## 🌐 REST API Reference

The C++ server exposes the following REST endpoints on port `8080`:

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | Public | Returns server health status JSON (`{"healthy": true}`). |
| `POST` | `/api/login` | Public | Verifies `@srmap.edu.in` domain and role authorization. |
| `GET` | `/api/complaints` | Filtered | Returns complaint records. Students only receive their own records (`?email=...`). Admins receive all records (`?adminEmail=...`). |
| `POST` | `/api/complaints` | Student | Registers a new grievance ticket with auto-priority. |
| `POST` | `/api/status` | Admin | Updates complaint status (`Pending`, `In Progress`, `Resolved`), remarks, and technician assignment. |
| `POST` | `/api/complaints/delete` | Admin | Permanently deletes a complaint record by ID (`id=...&adminEmail=...`). |
| `GET` | `/api/stats` | Public | Returns aggregate metrics (Total, High Priority, Pending, In Progress, Resolved). |
| `GET` | `/api/admin/list` | Admin | Lists all authorized administrator emails. |
| `POST` | `/api/admin/assign` | Admin | Adds an email to the internal administrator roster. |
| `POST` | `/api/admin/revoke` | Admin | Removes an email from the administrator roster. |

---

## 🧪 Automated Testing & Verification

A suite of 5 comprehensive automated regression test scripts is provided in `scratch/`. You can execute all tests with:

```powershell
node scratch/test_admin_csv_and_dashboard.js
node scratch/test_student_identity_extraction.js
node scratch/verify_domain_restrictions.js
node scratch/test_suite.js
node scratch/test_comprehensive_quality.js
```

Or execute all test suites in a single command:
```cmd
cmd /c "node scratch/test_admin_csv_and_dashboard.js && node scratch/test_student_identity_extraction.js && node scratch/verify_domain_restrictions.js && node scratch/test_suite.js && node scratch/test_comprehensive_quality.js"
```

### Test Suite Coverage:
- **`test_admin_csv_and_dashboard.js`** (41 tests): Verifies complete removal of CSV button from Student Portal, 5 Admin export scopes, 14 required columns, formula injection defense (`=`, `+`, `-`, `@`), and multi-filter combinations.
- **`test_student_identity_extraction.js`** (31 tests): Verifies extraction of student name and roll number from `Full Name | Roll Number` Google display names, `readonly` attributes, and privacy filtering.
- **`verify_domain_restrictions.js`** (17 tests): Verifies strict `@srmap.edu.in` rejection of external Gmail accounts, subdomain spoofing, and unauthorized admin attempts.
- **`test_suite.js`** (18 tests): End-to-end integration covering login, ticket lifecycle, roster assignment, and status updates.
- **`test_comprehensive_quality.js`** (23 tests): Verifies multiline description sanitization, duplicate grievance rejection (`409 Conflict`), file storage mirroring, and mobile CSS breakpoint compliance.

**Overall Test Results**: **130 / 130 PASSED (100% SUCCESS)**. All 6 initial seeded records (#101–#106) are preserved intact.
