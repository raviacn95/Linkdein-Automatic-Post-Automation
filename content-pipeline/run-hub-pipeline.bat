@echo off
cd /d "%~dp0.."
echo [%date% %time%] LearnHub pipeline start>> content-pipeline\data\pipeline.log
rem hub:pipeline now auto-deploys to https://raviacn95.github.io/
call npm run hub:pipeline -- --limit 5 >> content-pipeline\data\pipeline.log 2>&1
echo [%date% %time%] LearnHub pipeline end>> content-pipeline\data\pipeline.log
exit /b %ERRORLEVEL%
