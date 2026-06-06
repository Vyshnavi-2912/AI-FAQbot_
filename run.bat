@echo off
title NexusFAQ AI Runner
echo ==========================================
echo       NexusFAQ AI - Start Console
echo ==========================================
echo.
echo [1/2] Checking and installing Python dependencies...
python -m pip install -r requirements.txt
echo.
echo [2/2] Starting local Flask server...
echo.
echo Server will be hosted at: http://127.0.0.1:5000/
echo Press Ctrl+C in this window to stop the server.
echo.
python app.py
pause
