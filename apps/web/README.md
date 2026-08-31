# Travel AI Assistant Web

Frontend ReactTS + Vite cho Travel AI Assistant.

## Chay local

```bash
cd apps/web
npm install
npm run dev
```

Vite dev server mac dinh chay tai:

```txt
http://localhost:5173
```

Frontend goi backend qua `/api/chat`. Trong dev mode, Vite proxy `/api` ve `http://localhost:8000`.

Backend can chay rieng:

```bash
cd apps/api
npm run dev
```

## Env

Neu muon goi backend khac origin/proxy, tao `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```
