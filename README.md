# CampusCare — Campus Complaint Management System

A third-semester C++ subject project with a connected web frontend. The C++ backend manages complaint records and persists them in a text file; HTML/CSS/JavaScript provide the browser interface.

## Features

- Submit a complaint with student name, roll number, category, and description.
- Automatically assign a complaint ID (starting at 101).
- View, search, and filter all complaints.
- Update status to Pending, In Progress, or Resolved.
- Display live totals for each status.
- Save records to `complaints.txt` so records survive a server restart.
- Includes both a menu-driven C++ CLI (Option A) and connected website (Options B + C).

## Project layout

```text
CampusComplaintSystem/
├── backend/
│   ├── Complaint.h
│   ├── ComplaintManager.h
│   ├── ComplaintManager.cpp
│   ├── cli_main.cpp
│   └── server.cpp
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── CMakeLists.txt
├── .gitignore
└── README.md
```

## Requirements

- A C++17 compiler: GCC, Clang, or a recent Visual Studio C++ compiler.
- CMake 3.16 or newer.
- Git (for GitHub upload).

No third-party C++ libraries are required. The server uses platform sockets (Winsock on Windows and POSIX sockets on Linux/macOS).

## Build the project

Run these commands from the project root (`CampusComplaintSystem`).

### Windows (PowerShell, with CMake and a C++ compiler installed)

```powershell
cmake -S . -B build
cmake --build build --config Release
```

Start the web server. With a Visual Studio multi-config generator:

```powershell
Set-Location backend
..\build\Release\complaint_server.exe
```

If your generator puts executables directly in `build`, run `..\build\complaint_server.exe` instead.

Open **http://localhost:8080** in your browser. Keep the terminal open while using the website. Press `Ctrl+C` to stop the server.

### Linux / macOS (terminal)

Install a compiler and CMake if needed, then run:

```bash
cmake -S . -B build
cmake --build build -j
cd backend
../build/complaint_server
```

Open **http://localhost:8080**. Keep the terminal open while using the website. Press `Ctrl+C` to stop the server.

> Run the server from the `backend` folder so it can find `complaints.txt` there and serve the frontend from `../frontend`.

## Option A — Run the C++ menu program

Build as above, then from the project root:

**Windows:**

```powershell
.\build\Release\complaint_cli.exe
```

If your build generator places the executable directly in `build`, use `build\complaint_cli.exe` from the project root (without the Release folder).

**Linux / macOS:**

```bash
./build/complaint_cli
```

The CLI supports submitting, listing, searching, updating status, and viewing statistics. It stores its records in the current working directory's `complaints.txt`. To share records between the CLI and web server, run both from `backend` and use the appropriate executable path.

## How the connected frontend works (Option C)

- `GET /api/complaints` returns complaint records as JSON.
- `POST /api/complaints` accepts URL-encoded form fields and creates a complaint.
- `POST /api/status` accepts `id` and `status` and updates a record.
- The C++ server serves `index.html`, `style.css`, and `script.js` on the same origin at port 8080.

This is a student demonstration project, not a production service. The admin panel is intentionally unauthenticated, so do not expose it to the public internet or enter real sensitive student information. For a real deployment, add authentication, authorization, stronger validation, and a database.

## Troubleshooting

- **Port 8080 is busy:** stop the other process using it, or change the port in `backend/server.cpp` and rebuild.
- **Website says server unavailable:** make sure `complaint_server` is running and open `http://localhost:8080` (do not double-click the HTML file).
- **Frontend file not found:** start the server from the `backend` directory.
- **Compiler missing:** install a C++17 compiler and CMake, then rerun the build commands.

## GitHub: create a repository and push

First create an **empty repository** on GitHub (do not add a README or `.gitignore` there, because this folder already contains them). Copy the repository URL from GitHub. Then run these commands from the project root, replacing `YOUR_USERNAME` and `CampusComplaintSystem` with your details:

```bash
git init
git add .
git commit -m "Add CampusCare complaint management project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/CampusComplaintSystem.git
git push -u origin main
```

If Git says `remote origin already exists`, update it instead:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/CampusComplaintSystem.git
git push -u origin main
```

For later changes:

```bash
git status
git add .
git commit -m "Describe your changes"
git push
```

GitHub authentication may ask you to sign in via a browser or use a personal access token; your normal account password is not accepted for HTTPS Git pushes. Never commit passwords, tokens, or real student complaint records.
