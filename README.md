# Wysa Appointment Booking System

A full-stack appointment booking system where patients can view, hold, and book appointment slots with therapists. Supports recurring appointments with multiple recurrence frequencies.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite via Prisma ORM
- **Auth**: JWT-based authentication

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Therapist | therapist@wysa.com | password123 |
| Patient 1 | patient1@wysa.com | password123 |
| Patient 2 | patient2@wysa.com | password123 |

## Getting Started

### Prerequisites
- Node.js 18+

### Setup

```bash
# Backend
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
node prisma/seed.js
npm run dev

# Frontend (in a new terminal)
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`.

## Deployment on Render

This project is configured for 1-click deployment on [Render](https://render.com) using a single Web Service (serving both the Node.js API and the built React frontend) or via Blueprint.

### Option 1: Deploy via Render Web Service (Manual)

1. Push your repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Configure the settings:
   - **Name**: `wysa-appointment-booking` (or your preferred name)
   - **Language**: `Node`
   - **Branch**: `main`
   - **Root Directory**: *(leave blank)*
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
5. Add Environment Variables in the **Environment** tab:
   - `DATABASE_URL`: `file:./dev.db`
   - `JWT_SECRET`: `your-secure-random-jwt-secret`
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service**.

### Option 2: Deploy via Blueprint (`render.yaml`)

1. Push your repository containing `render.yaml` to GitHub.
2. In Render, go to **Blueprints** → **New Blueprint Instance**.
3. Connect your repository — Render will automatically read `render.yaml` and set up the service, build commands, and environment variables.
4. Click **Apply**.

---

## Technical & Architectural Challenges

### 1. Concurrency Control for Slot Holding
**Challenge**: When two patients try to hold the same slot simultaneously, race conditions can cause double-bookings.

**Approach**: SQLite serializes all writes internally. We use Prisma transactions with conflict checking — the transaction first cleans up expired holds, then checks for active conflicts, and only then creates the hold. SQLite's write lock ensures these steps are atomic.

### 2. Distributed Idempotency (3 Server Clusters)
**Challenge**: With the backend deployed across 3 server clusters, a patient's confirm request might be processed by different servers, potentially creating duplicate bookings.

**Approach**: Every booking confirmation includes a client-generated `idempotency_key` stored as a UNIQUE column in the appointments table. If a duplicate request arrives at any server, the database constraint prevents it. The confirm endpoint checks for an existing idempotency key first and returns the existing booking if found.

### 3. Temporary Slot Hold Persistence Across Refresh
**Challenge**: The 1-minute hold timer must survive page refreshes without losing the hold state.

**Approach**: Hold metadata (appointment ID, expiry timestamp, therapist info) is stored in `localStorage`. On page load, the app checks if an active hold exists and resumes the countdown from the server-stored `holdExpiresAt` timestamp. The server remains the source of truth — even if localStorage is tampered with, the server validates hold expiry before confirming.

### 4. Expired Hold Cleanup Without Cron Jobs
**Challenge**: Expired holds must be cleaned up so slots become available again.

**Approach**: Lazy cleanup — no background cron job. The slot availability endpoint treats holds with `holdExpiresAt < now()` as available. When a new hold or booking targets a slot with an expired hold, the stale row is cleaned up within the same transaction.

### 5. Recurring Appointments with Conflict Detection
**Challenge**: When booking a recurring series (daily/weekly/biweekly/monthly), some future slots may already be booked by other patients.

**Approach**: On recurring confirmation, 12 future instances are generated. Each is conflict-checked individually. Conflicting slots are skipped rather than failing the entire series. Patients can cancel a single instance without cancelling the series, or cancel the entire series at once.

### 6. Schedule Updates Without Affecting Bookings
**Challenge**: When a therapist updates their schedule, existing bookings should not be affected.

**Approach**: Existing bookings are stored as concrete timestamps (not references to schedule slots). The therapist schedule is only used to derive available slots for future dates. Updating the schedule simply changes what new slots appear — existing bookings remain untouched.

### 7. Appointment Status Updates During Window
**Challenge**: Therapists should only be able to mark appointments as completed/no_show during or after the appointment window.

**Approach**: The status update endpoint checks `now >= appointment.startTime` before allowing status changes (except cancellation, which is always allowed). This prevents premature status changes.

### 8. Timezone Normalization Across Server & Client
**Challenge**: The specification assumes users and therapists are in the same timezone. When the server runs in a cloud environment (e.g., UTC on Render) while users are in local timezones (e.g., UTC+5:30), converting timestamps with browser defaults causes time shifts (e.g., 1:30 PM shifting to 7:00 PM).

**Approach**: Dates and times are constructed and formatted using normalized UTC across both the backend (`Date.UTC`, `getUTCHours()`, `getUTCDay()`) and the frontend (`timeZone: 'UTC'` formatting). This ensures wall-clock schedule consistency regardless of cloud server region or client browser timezone.