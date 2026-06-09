@echo off
title Axiom News API
:loop
echo [%date% %time%] Starting Axiom News API...
node server.js
echo [%date% %time%] Process crashed. Restarting in 10 seconds...
timeout /t 10 /nobreak > nul
goto loop
