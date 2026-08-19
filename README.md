# 🛡️ SafeRoute — AI Personal Safety Companion (FastAPI + MongoDB + Mobile PWA)

SafeRoute is a production-grade, responsive Progressive Web App (PWA) built with a **FastAPI + MongoDB** backend.

---

## 🎯 Architecture & Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, `vite-plugin-pwa`, Leaflet & OpenStreetMap, WebSockets.
- **Backend:** Python 3.14 + **FastAPI** + **MongoDB** (`motor` / `pymongo`).
- **Real Device Hardware Capabilities:**
  - Real hardware GPS coordinates (`navigator.geolocation`).
  - User-initiated audio/video evidence capture on emergency panic (`MediaRecorder`).
  - Spoken check-in transcription (`SpeechRecognition` / Web Speech API).
  - VAPID Web Push notifications (`pywebpush`) + real-time WebSockets (`/ws/trips/{trip_id}`).
  - IndexedDB offline queue (`saferoute-offline`) during signal loss.

---

## 🔬 Pytest Test Suite Execution

```bash
cd backend_fastapi
python -m pytest tests/test_api.py
```

Output:
```
tests/test_api.py .... [100%]
4 passed in 2.31s
```

---

## 🚀 Local Run Instructions

### 1. Start FastAPI + MongoDB Backend (Port 3001)
```bash
cd backend_fastapi
python -m uvicorn app.main:app --host 0.0.0.0 --port 3001
```

### 2. Start Frontend Dev Server
```bash
cd frontend
npm run dev
```

### 3. Open in Browser
- **Desktop:** `http://localhost:5174/`
- **Mobile Phone (Local Wi-Fi):** `http://192.168.73.48:5174/`
