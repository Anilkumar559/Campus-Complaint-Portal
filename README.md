# SRM University-AP — Campus Grievance & Facility Portal

A high-performance C++17 backend and modern web frontend engineered specifically for **SRM University-AP, Andhra Pradesh** (`@srmap.edu.in`).

The portal provides an intuitive Single Sign-On (SSO) login experience for **Students** and **Campus Facility Administrators / Wardens**, featuring Google Sign-In with Firebase Authentication, real-time grievance submission, automated keyword-based priority determination, location mapping across SRM AP hostel and academic blocks, live status tracking, maintenance remarks, and CSV audit reporting.

---

## 🏛️ University Branding & Credentials

- **Institution**: SRM University-AP, Andhra Pradesh (Neerukonda, Amaravati)
- **Official Domain**: Students and Staff authenticate using `@srmap.edu.in` or authorized Google accounts.
- **Portal URL**: `http://localhost:8080` (or your active VS Code Dev Tunnel / production domain)

---

## 🔐 Firebase Google Authentication Configuration

This application connects to Firebase Authentication (`srmap-complaints`) for Google Single Sign-On.

### 🌐 Authorizing Your Domain in Firebase Console
If accessing the portal via a new domain (e.g. VS Code Dev Tunnel, ngrok, or production):
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select the **`srmap-complaints`** project.
3. Navigate to **Authentication → Settings → Authorized domains**.
4. Click **Add domain** and enter your hostname (for example: `2gscpknn-8080.inc1.devtunnels.ms` or `*.devtunnels.ms`).
5. Click **Save**.

*Note: `localhost` is authorized by default.*

### 🛡️ Dual-Role Authentication & Server-Side Administrator Privileges
- Both **Student Login** and **Admin Login** use the same Firebase Google Authentication provider.
- The **same Google account** (e.g. `student@gmail.com` or `ap23110010838@srmap.edu.in`) can be used for both options:
  - **Student Login**: Always routes to the Student Dashboard, retrieving Google display name and email.
  - **Admin Login**: Evaluated strictly on the server against `backend/admins.txt`. If the account is internally assigned administrator privileges, access is granted. Otherwise, the server responds with **`403 Forbidden` (Access Denied)**.
- **Assigning / Revoking Administrator Privileges Internally**:
  - **Via Command Line**:
    ```cmd
    manage_admins.bat list
    manage_admins.bat add user@gmail.com
    manage_admins.bat remove user@gmail.com
    ```
  - **Via Admin Dashboard (UI)**: Authenticated administrators can manage the administrator roster directly inside the Admin Dashboard under **Administrator Roster**.

---

## 🚀 Quick Start (Windows)

Simply double-click **`build_and_run.bat`** in the project root:
```bat
build_and_run.bat
```
It will:
1. Terminate any previous `complaint_server.exe` instance.
2. Compile both `complaint_server.exe` and `complaint_cli.exe` using `g++` (C++17).
3. Synchronize binaries and start the web server on **http://localhost:8080**.

---

## 💻 Running the Command-Line Interface (CLI)

You can also interact directly with the C++ database via the console tool:
```bat
complaint_cli.exe
```
**Features in CLI**:
- Submit new grievances with auto-assigned priority
- View formatted complaint records with timestamps and maintenance remarks
- Search tickets by ID
- Update status (`Pending`, `In Progress`, `Resolved`) and add warden action notes
- Delete tickets
- Display real-time campus metrics

---

## 🌟 Key System Capabilities

### 1. Dual-Role Authentication Portal
- Dedicated tabs for **Student Login** and **Admin & Warden Login**.
- Strict domain validation enforcing `@srmap.edu.in`.
- Single-click quick fill demo buttons for effortless evaluation.
- Session persistence via `localStorage` with instant logout / account switching.

### 2. Smart Auto-Priority Rule Engine (C++ & Client)
- Dynamically analyzes category and description keywords in real time:
  - **High Priority (Hazard / Critical)**: Sparks, short circuits, fire, shock, gas, water burst, blackout, broken door locks, geyser issues, medical hazards.
  - **Medium Priority**: SRMAP Wi-Fi drops, NetAccess issues, classroom projectors, hostel room fans, mess food quality, water cooler filters.
  - **Low Priority**: Library seating, routine sanitation, waste bins, furniture requests.

### 3. SRM AP Campus Location & Hostel Block Tagging
- Structured block selection tailored to the SRM AP campus:
  - **Hostel Blocks**: Ganga, Yamuna, Krishna, Kaveri, Godavari, Narmada, Mahanadi, Brahmaputra.
  - **Academic & Common Facilities**: Neerukonda Academic Block, ALC (Active Learning Centre), Central Library, Admin Block, Dining Halls / Mess 1 & 2, Sports Complex, Health Center.
  - Room / Floor / Lab number specifications.

### 4. Student vs Admin Workspaces
- **Student View**:
  - Auto-fills student name, roll number, and email.
  - **"My Registered Grievances"** tab to monitor personal ticket progress and technician action notes.
  - Read-only protection preventing alteration of others' complaints.
  - **"All Campus Tickets"** public feed.
- **Admin & Warden View**:
  - Live complaint queue with instant inline status updates (`Pending` -> `In Progress` -> `Resolved`).
  - Maintenance remarks input (e.g., *"Electrician dispatched"*, *"Filter cartridge replaced"*).
  - Quick Emergency filter pills (High Urgency, Pending assignment, Hostel blocks).
  - Permanent ticket deletion control.
  - CSV audit report export with university headers.

---

## 🗄️ Storage Record Format (`complaints.txt`)

Data is persisted on disk in pipe-delimited records:
```text
TicketID | StudentName | RollNumber | Location/Room | Category | Priority | Status | Description | CreatedAt | UpdatedAt | Email | AdminRemarks
```
*Backward-compatible with legacy 6, 8, and 10-field records with automatic on-the-fly migration.*
