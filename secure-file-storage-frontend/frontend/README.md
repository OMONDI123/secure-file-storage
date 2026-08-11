# Secure File Storage — Frontend

A React + TypeScript single-page app for the Secure File Storage assignment, built with Vite and Tailwind CSS.

Users can register, sign in, drag-and-drop upload files (100MB+, with live progress), see all their files in a dashboard, toggle any file between public and private, copy a shareable link, and download or delete files. Anyone with a public share link can view and download that file without an account.

## Tech stack

- React 19 + TypeScript
- Vite
- React Router (client-side routing)
- Tailwind CSS v4
- Axios (with an interceptor that silently refreshes the access token on 401s)

## Prerequisites

- Node.js 20+
- The backend (in `../backend`) running and reachable — see its README to get it up first.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
```

By default `.env` points at `http://localhost:4000`, which matches the backend's default port. If your backend runs somewhere else, update `VITE_API_BASE_URL` accordingly.

## Run

```bash
npm run dev
```

Open `http://localhost:5173`. **The backend must be running first** (or requests will fail) — see `../backend/README.md`.

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API | `http://localhost:4000` |

## How this talks to the backend

- On login/register, the backend returns a short-lived **access token** in the JSON response, which this app keeps in memory (not `localStorage`, to reduce XSS exposure) and attaches to every API request as `Authorization: Bearer <token>`.
- The backend also sets a long-lived **refresh token** as an `httpOnly` cookie, which the browser sends automatically. On page reload, the app calls `POST /api/auth/refresh` to silently restore the session using that cookie — that's why `axios` is configured with `withCredentials: true`.
- If any request comes back `401`, an interceptor automatically calls `/api/auth/refresh` once and retries the original request, so a session doesn't get logged out just because the 15-minute access token expired mid-session.
- Uploads use `multipart/form-data` with `axios`'s `onUploadProgress` callback to drive the progress dial in real time.
- A file's public share link (`shareUrl`) points at this app's own `/share/:token` route, which fetches the file's metadata from the backend's public endpoint and renders a plain download page — no login required to view it.

**For this to work, the backend's `CLIENT_ORIGIN` env var must match this app's actual origin** (`http://localhost:5173` by default), or the browser will block the requests via CORS and the refresh cookie won't be accepted.

## Project structure

```
src/
  api/          axios client (token attach + refresh interceptor), files.ts, auth calls
  components/   Navbar, FileUploadZone, FileLedger, ProgressDial, StatusStamp, ProtectedRoute, AuthLayout
  context/      AuthContext (register/login/logout, current user)
  pages/        Login, Register, Dashboard, PublicFile
  types/        shared TypeScript interfaces
  utils/        formatting helpers (bytes, dates)
```

## Design notes

The interface leans into a "bank vault ledger" visual metaphor — files are "deposits," a public file is "shared," a private file is "sealed," and upload progress is shown as a safe-combination dial instead of a plain progress bar. This was a deliberate choice to avoid a generic, templated admin-dashboard look while keeping the actual interaction patterns (forms, tables, drag-and-drop) conventional and easy to use.

## What's not included

- No automated test suite (unit/e2e) — given the ~5h scope, testing time went into manually verifying the auth, upload, sharing, and authorization flows end-to-end against the real backend instead.
- No dark/light theme toggle — the app is dark-themed only.
