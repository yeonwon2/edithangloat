@echo off
chcp 65001 > nul
title DichTruyenPro - Khoi Dong May Chu
echo =======================================================
echo    DichTruyenPro - Dich Truyen Chu Hang Loat Gemini AI
echo =======================================================
echo.
echo Dang khoi dong may chu tai http://localhost:3001 ...
echo Vui long mo trinh duyet va truy cap: http://localhost:3001
echo.
start http://localhost:3001
node server.js
pause
