
@echo off
cd backend
echo Running initial migration...
alembic revision --autogenerate -m "Initial migration"
echo Applying migration...
alembic upgrade head
echo Done!
pause
