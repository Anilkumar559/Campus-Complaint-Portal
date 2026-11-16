@echo off
setlocal
cd /d "%~dp0backend"

if "%~1"=="" goto usage
if /i "%~1"=="list" goto list
if /i "%~1"=="add" goto add
if /i "%~1"=="remove" goto remove

:usage
echo ========================================================
echo SRM UNIVERSITY-AP CAMPUS CARE - ADMIN PRIVILEGE MANAGER
echo ========================================================
echo.
echo Usage:
echo   manage_admins.bat list
echo   manage_admins.bat add [user@srmap.edu.in or user@gmail.com]
echo   manage_admins.bat remove [user@srmap.edu.in or user@gmail.com]
echo.
goto end

:list
echo.
echo [Current Authorized Administrators]:
if exist admins.txt (
  type admins.txt
) else (
  echo No admins.txt found.
)
echo.
goto end

:add
if "%~2"=="" (
  echo Error: Please specify the email to grant admin privileges.
  echo Example: manage_admins.bat add student@gmail.com
  goto end
)
echo %~2>> admins.txt
echo [SUCCESS] Granted administrator privileges to: %~2
echo.
goto end

:remove
if "%~2"=="" (
  echo Error: Please specify the email to revoke admin privileges.
  echo Example: manage_admins.bat remove student@gmail.com
  goto end
)
node -e "const fs=require('fs'); let lines=fs.readFileSync('admins.txt','utf8').split(/\r?\n/).filter(l=>l.trim().toLowerCase() !== '%~2'.toLowerCase() && l.trim().length > 0); fs.writeFileSync('admins.txt',lines.join('\n') + '\n'); console.log('[SUCCESS] Revoked administrator privileges from: %~2');"
echo.
goto end

:end
