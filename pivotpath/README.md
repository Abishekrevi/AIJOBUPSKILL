# PivotPath — AI-Powered Workforce Transition Platform

## Quick Start (Local Development)

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API runs at http://localhost:8000
Swagger docs at http://localhost:8000/docs

### 2. Frontend
```bash
cd frontend
npm install
npm start
```
App runs at http://localhost:3000

---

## Environment Variables

### Backend (.env or Render environment)
```
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname   # leave blank for SQLite dev
OPENAI_API_KEY=sk-...                                      # optional — smart fallback if missing
```

### Frontend (.env or Render environment)
```
REACT_APP_API_URL=https://your-backend.onrender.com       # blank = uses proxy in dev
```

---

## Deploy to Render (step by step)

### Backend — Web Service
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - Root directory: `backend`
   - Runtime: Python 3
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `DATABASE_URL` → your Postgres URL (Render provides free Postgres)
   - `OPENAI_API_KEY` → your OpenAI key (optional)
5. Deploy

### Frontend — Static Site
1. Render → New → Static Site
2. Connect repo
3. Settings:
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `build`
4. Add environment variable:
   - `REACT_APP_API_URL` → https://your-backend.onrender.com
5. Deploy

### Free Postgres on Render
- Render → New → PostgreSQL
- Copy the "Internal Database URL"
- Paste as `DATABASE_URL` on your backend service

---

## Project Structure

```
pivotpath/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLAlchemy models + seeding
│   ├── requirements.txt
│   └── routers/
│       ├── workers.py       # Worker CRUD
│       ├── coach.py         # AI career coach (OpenAI)
│       ├── credentials.py   # Credential marketplace
│       ├── employers.py     # Employer pipeline
│       ├── hr.py            # HR SaaS dashboard
│       └── signal.py        # Skills demand signal
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.js            # Router + global state
        ├── index.js
        ├── index.css
        ├── lib/api.js        # Axios API client
        ├── components/
        │   └── Layout.js     # Sidebar nav
        └── pages/
            ├── Onboarding.js # Worker registration
            ├── Dashboard.js  # Worker home
            ├── Coach.js      # AI chat interface
            ├── Credentials.js # Marketplace
            ├── Signal.js     # Skills demand data
            ├── Employers.js  # Employer pipeline
            └── HRDashboard.js # HR admin view
```

---

## Adding OpenAI

The AI coach works without an API key (smart rule-based fallback). To enable GPT-4o:

1. Get a key at https://platform.openai.com
2. Set `OPENAI_API_KEY` in backend environment
3. Restart backend — that's it

---

## GitHub Setup

```bash
cd pivotpath
git init
git add .
git commit -m "feat: PivotPath MVP"
gh repo create pivotpath --public --push --source .
```
