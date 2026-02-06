# Start Presenza-AI in Production Mode
Write-Host "Starting Presenza-AI..." -ForegroundColor Cyan

# 1. Start Backend
Write-Host "Starting Backend (Port 8000)..." -ForegroundColor Green
Start-Process -FilePath "uvicorn" -ArgumentList "app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory ".\backend" -NoNewWindow
# Note: In a real script we might want separate windows or reliable background jobs, but for simple usage:
# If you want to see logs, maybe run in separate terminal.
# Let's try to start it in a new window to keep this one clean or hold.
# Start-Process "uvicorn" ... -NoNewWindow might mix logs. 

# 2. Build Frontend (if not already?)
# Write-Host "Building Frontend..."
# Set-Location ".\frontend"
# npm run build
# Set-Location ".."

# 3. Start Frontend
Write-Host "Starting Frontend (Port 3000)..." -ForegroundColor Green
# Start-Process "npm" -ArgumentList "start" -WorkingDirectory ".\frontend"

Write-Host "Both services attempting to start. Please check logs."
Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Press Ctrl+C to stop (if caught) or close windows."

# Alternative: explicit separate windows suitable for Windows users
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run build; npm start"
