import subprocess
import time
import sys
import os
import webbrowser

def main():
    print("=" * 60)
    print(" 🛡️  SafeRoute AI Safety Companion — All-in-One Desktop App")
    print("=" * 60)

    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, "backend_fastapi")
    frontend_dir = os.path.join(project_root, "frontend")

    print("[1/3] Starting FastAPI + MongoDB Backend (Port 3001)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"],
        cwd=backend_dir
    )

    print("[2/3] Starting Vite Frontend (Port 5174)...")
    frontend_proc = subprocess.Popen(
        ["npx.cmd" if os.name == "nt" else "npx", "vite", "--port", "5174"],
        cwd=frontend_dir
    )

    time.sleep(3)

    app_url = "http://localhost:5174/"
    print(f"[3/3] Opening SafeRoute Standalone Desktop Window: {app_url}")

    # Launch in standalone App Window Mode
    if os.name == "nt":
        try:
            subprocess.Popen(["start", "msedge", f"--app={app_url}"], shell=True)
        except Exception:
            webbrowser.open(app_url)
    else:
        webbrowser.open(app_url)

    print("=" * 60)
    print(" ✓ SafeRoute Desktop App Active!")
    print(" Press Ctrl+C in this console to exit.")
    print("=" * 60)

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
