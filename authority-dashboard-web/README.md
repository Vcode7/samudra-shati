# Authority Dashboard Web

Separate web app for authorities.

## Setup

1. Create env file:

```bash
copy .env.example .env.local
```

2. Fill in:

- `NEXT_PUBLIC_BACKEND_BASE_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

3. Install + run:

```bash
npm install
npm run dev
```

## Notes

- Login uses `POST /api/authorities/login` from the FastAPI backend.
- Registration uses `POST /api/authorities/register` and requires header `X-Client: web` (backend enforced).
- Authority verification uses `POST /api/authorities/{disaster_id}/verify`.
