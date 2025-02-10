@echo off
REM Lösche den dist Ordner
if exist ".\dist" rmdir /s /q ".\dist"

REM Führe npm build aus
call npm run build

REM Starte n8n Container neu
docker-compose restart

echo finished
