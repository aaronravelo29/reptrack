# RepTrack

Real Estate Professional (REP) tracking app for IRS §469(c)(7).

## 🚀 Setup (UPDATED)

### 1. Install dependencies
```
npm install
```

### 2. Add environment variables
Create a `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

⚠️ Do NOT commit secrets to GitHub.

### 3. Run locally
```
npm run dev
```

---

## 🔐 Security Update

- Removed hard dependency on inline Supabase keys
- Added env-based configuration (`supabaseClient.js`)
- Preparing migration away from localStorage auth

---

## 🧱 Architecture Direction

- Supabase → Auth + Database
- Vercel → AI proxy
- React → UI only

Next steps:
- Replace custom auth with Supabase client
- Move CRUD into services layer
- Add structured AI responses

---

## ⚠️ Known Technical Debt

- Monolithic `App.jsx`
- Manual auth/session handling
- REST fetch instead of Supabase SDK

---

## 🎯 Status

MVP → Transitioning to production-ready architecture
