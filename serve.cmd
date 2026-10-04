@echo off
setlocal
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

where py >nul 2>&1
if not errorlevel 1 (
    echo CSE 219 demos: http://127.0.0.1:%PORT%/
    echo Press Ctrl+C to stop the server.
    py -3 -m http.server "%PORT%" --bind 127.0.0.1
    exit /b
)

where python >nul 2>&1
if not errorlevel 1 (
    echo CSE 219 demos: http://127.0.0.1:%PORT%/
    echo Press Ctrl+C to stop the server.
    python -m http.server "%PORT%" --bind 127.0.0.1
    exit /b
)

echo Python 3 was not found. Install Python 3 and enable "Add python.exe to PATH".
exit /b 1
