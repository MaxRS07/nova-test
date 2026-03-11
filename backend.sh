PID=$(lsof -i :8000 -t)
kill -9 $PID
echo "Starting backend server..."
cd server
source .venv_py313/bin/activate
python3 main.py
echo "Backend server deployed successfully"