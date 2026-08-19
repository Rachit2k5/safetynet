import sys
import os

# Add root directory and backend_fastapi directory to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend_fastapi")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set Vercel environment flag
os.environ["VERCEL"] = "1"

try:
    from backend_fastapi.app.main import app
except ImportError as e:
    # Fallback: try direct import since backend_dir is on path
    print(f"[WARN] Package import failed ({e}), trying direct import...")
    from app.main import app

# Vercel needs the `app` variable exported at module level
handler = app
