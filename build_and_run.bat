@echo off
echo Stopping any running complaint_server.exe...
taskkill /F /IM complaint_server.exe >nul 2>&1

cd /d "%~dp0backend"
echo Compiling complaint_server.exe and complaint_cli.exe...
g++ -std=c++17 -O2 server.cpp ComplaintManager.cpp -lws2_32 -o complaint_server.exe
if %errorlevel% neq 0 (
    echo Build failed! Make sure g++ (MinGW) is in your PATH.
    pause
    exit /b 1
)
g++ -std=c++17 -O2 cli_main.cpp ComplaintManager.cpp -o complaint_cli.exe

echo Starting Campus Complaint Portal at http://localhost:8080 ...
complaint_server.exe
