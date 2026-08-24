# AI Usage Documentation

## Tools and Prompts

### Tools Used
- **Google Antigravity (Claude)**: Used as a pair-programming assistant for architecture planning, code generation, and implementation decisions.

### Exact Prompts

**Prompt 1 — Data Modeling & Dynamic Slot Derivation:**
> "How should we design the database schema and slot generation logic for an appointment booking system where therapist availability is defined by recurring daily/weekly time windows (rather than pre-seeded static slots), while supporting temporary 1-minute holds and recurring bookings?"

I used AI to explore trade-offs between pre-generating static slot rows vs. deriving slots dynamically at query time from therapist schedules. We decided to derive slots dynamically to ensure therapist schedule updates don't mutate or invalidate existing booking records.

**Prompt 2 — Database Simplification:**
> "Can we put the database as Sqlite for the sake of simplicity and deployment"

I chose to simplify from PostgreSQL to SQLite since the project is a take-home assessment and SQLite eliminates the need for a separate database server. The AI updated the concurrency strategy from `SELECT...FOR UPDATE` to SQLite's WAL mode with IMMEDIATE transactions.

**Prompt 3 — Questioning AI's Design:**
> "Does sqlite provide a TTL feature, if yes then why do we need a cron job to clean things"

I challenged the AI's initial design that included a cron job for cleaning expired holds. The AI had incorrectly labeled the approach as "SQLite TTL" when SQLite has no such feature. After this challenge, the design was simplified to lazy cleanup — no background process needed. Expired holds are simply filtered out during queries and cleaned up opportunistically during new transactions.

**Prompt 4 — Timezone Discrepancy:**
> "I selected 1pm appointment but it is showng this on the frontend: Mon, Aug 24, 2026 07:00 PM – 07:30 PM"

I caught a timezone skew issue where the server (running in UTC) and the client browser (running in UTC+5:30) caused slot timestamps to shift by +5:30 hours when formatted with default browser locales. We resolved this by normalizing all datetime construction and formatting to UTC across both backend services and frontend components, guaranteeing identical wall-clock times regardless of cloud deployment region.

## Technical Decisions

### 1. Concurrency Handling
- **AI recommended**: PostgreSQL with `SELECT...FOR UPDATE` row-level locking.
- **What I implemented**: SQLite with transactional conflict detection. SQLite serializes all writes via its internal locking mechanism, so within a Prisma `$transaction`, the conflict check → hold creation sequence is atomic.
- **Trade-off**: SQLite's single-writer model means write throughput is limited, but for an appointment booking system with moderate traffic, this is perfectly adequate. For production scale, PostgreSQL with advisory locks or `FOR UPDATE` would be more appropriate.

### 2. Distributed Idempotency
- **AI recommended**: Client-generated idempotency keys stored as a UNIQUE column.
- **What I implemented**: Same approach. The idempotency key is generated client-side as `{patientId}:{slotStartTime}:{timestamp}` and sent with the confirm request. The UNIQUE constraint in the database ensures that even if the same request hits different server clusters, only one booking is created.
- **Trade-off**: This approach ties idempotency to the database layer rather than using a distributed cache (like Redis). For the 3-server-cluster requirement, this works because all servers share the same database. If servers had separate databases, we'd need a distributed lock or consensus mechanism.

### 3. Recurring Appointment Design
- **AI recommended**: A `recurrences` table storing the pattern, with concrete appointment instances materialized in the `appointments` table.
- **What I implemented**: Same materialization approach — 12 future instances are created at booking time. Each instance is conflict-checked individually, and conflicting slots are skipped.
- **Trade-off**: Materializing appointments uses more storage but makes queries simple (no need to compute virtual recurring instances on every read). The alternative — virtual expansion at query time — would be more complex and error-prone, especially for conflict detection.

### 4. Hold Expiry Strategy
- **AI initially recommended**: A background cron job running every 30 seconds to clean up expired holds.
- **What I implemented**: Lazy cleanup with no background process. I challenged this recommendation because SQLite doesn't have TTL features, and a cron job adds unnecessary complexity.
- **Trade-off**: Lazy cleanup means expired hold rows may linger in the database until someone queries or holds that slot again. This is acceptable because: (1) the slot availability query already filters them out, and (2) the volume of holds is low.

### 5. Authentication
- **AI recommended**: JWT with bcrypt password hashing.
- **What I implemented**: Same approach with stateless JWT tokens (24h expiry). Tokens are stored in localStorage and attached via Axios interceptor.
- **Trade-off**: localStorage is vulnerable to XSS. For a production app, httpOnly cookies would be more secure. For this assessment, localStorage keeps the implementation simple and allows easy token management in the React frontend.

## Incorrect AI Suggestions

### 1. "SQLite TTL" Feature
The AI initially described the hold expiry mechanism as "SQLite TTL + server-side expiry check", implying SQLite has a built-in TTL feature. **SQLite has no such feature.** When I challenged this, the AI corrected itself and the design was simplified to pure server-side timestamp comparison with lazy cleanup. This was a meaningful architectural simplification — removing an unnecessary background cron job and relying on the simpler pattern of filtering expired records at query time.

### 2. PostgreSQL-Specific Concurrency Patterns
The initial plan used `SELECT...FOR UPDATE`, which is a PostgreSQL-specific feature not available in SQLite. After switching to SQLite, the AI correctly adapted the concurrency strategy to use SQLite's single-writer transaction model, but the initial suggestion was not portable across databases.
