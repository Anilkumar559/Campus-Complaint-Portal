@echo off
title SRM University-AP | Campus Grievance Portal
echo Stopping any running complaint_server.exe...
taskkill /F /IM complaint_server.exe >nul 2>&1

cd /d "%~dp0backend"
set GXX=g++
where g++ >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\MinGW\bin\g++.exe" (
        set GXX=C:\MinGW\bin\g++.exe
    )
)

echo Compiling SRM AP complaint_server.exe and complaint_cli.exe with %GXX%...
%GXX% -std=c++17 -O2 server.cpp ComplaintManager.cpp -lws2_32 -o complaint_server.exe
if %errorlevel% neq 0 (
    echo Build failed! Make sure g++ (MinGW) is in your PATH or C:\MinGW\bin.
    pause
    exit /b 1
)
%GXX% -std=c++17 -O2 cli_main.cpp ComplaintManager.cpp -o complaint_cli.exe

echo Copying latest executables to root directory...
copy /Y complaint_server.exe ..\ >nul 2>&1
copy /Y complaint_cli.exe ..\ >nul 2>&1

echo ======================================================================
echo   SRM UNIVERSITY AP - CAMPUS COMPLAINT MANAGEMENT SYSTEM
echo   Portal URL: http://localhost:8080
echo   University Domain: @srmap.edu.in
echo ======================================================================
complaint_server.exe
