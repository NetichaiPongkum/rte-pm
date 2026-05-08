# PM Mold RTE

ระบบจัดการงานซ่อมบำรุงแม่พิมพ์ (Preventive Maintenance Management System)

## Tech Stack
- **Frontend**: HTML + React 18 (CDN) + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Hosting**: Netlify / Vercel

## Project Structure
```
pm-mold-rte/
├── index.html              # Main entry point
├── serve.ps1               # Local dev server (PowerShell)
├── vercel.json             # Vercel deployment config
├── netlify.toml            # Netlify deployment config
├── css/
│   ├── variables.css       # Design tokens (colors, spacing, etc.)
│   ├── global.css          # Global styles & reset
│   ├── components.css      # Reusable component styles
│   └── animations.css      # Keyframes & animation utilities
├── js/
│   ├── app.js              # Main React application
│   └── supabase/
│       ├── client.js       # Supabase client initialization
│       ├── auth.js         # Authentication helpers
│       ├── database.js     # CRUD database helpers
│       └── storage.js      # File storage helpers
└── db/
    └── schema.sql          # Database schema for Supabase
```

## Getting Started

### 1. Setup Supabase
1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. คัดลอก **Project URL** และ **Anon Public Key** จาก Settings > API
3. อัพเดตค่าใน `js/supabase/client.js`

### 2. Create Database Tables
1. ไปที่ Supabase Dashboard > SQL Editor
2. คัดลอกเนื้อหาจาก `db/schema.sql` ไปรัน

### 3. Run Locally
```powershell
.\serve.ps1
```
เปิดเบราว์เซอร์ที่ http://localhost:8080

### 4. Deploy
- **Netlify**: Push to GitHub → Connect repo → Auto deploy
- **Vercel**: Push to GitHub → Import project → Auto deploy
