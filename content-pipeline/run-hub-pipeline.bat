@echo off
cd /d "%~dp0.."
call npm run hub:pipeline -- --limit 5
exit /b %ERRORLEVEL%
