# deploy_hf.ps1
# This script pushes only the backend to Hugging Face, safely bypassing large binary files in your local Git history.
Write-Host "Preparing to deploy to Hugging Face Spaces..."

# Go to backend
cd backend

# Ensure changes are staged if you just saved a file
git add .
Write-Host "Temporarily hiding test_face.jpg to bypass HF 2MB limit..."
Move-Item -Path "app\ai_engine\test_face.jpg" -Destination "..\test_face.jpg.bak" -ErrorAction SilentlyContinue 
git rm "app\ai_engine\test_face.jpg" --cached -q

# Generate clean snapshot
Write-Host "Generating isolated filesystem snapshot..."
$tree = git write-tree --prefix=backend
$commit = git commit-tree $tree -m "Deploy to HF"

# Force push
Write-Host "Pushing to Hugging Face..."
git push huggingface "$commit`:main" --force

# Restore files
Write-Host "Restoring local files..."
git reset HEAD . -q 
Move-Item -Path "..\test_face.jpg.bak" -Destination "app\ai_engine\test_face.jpg" -Force -ErrorAction SilentlyContinue 

cd ..
Write-Host "Deployment Complete!"
