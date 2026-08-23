# AI Usage Documentation

## Tools and Prompts

### Tools Used
- **Google Antigravity (Claude)**: Used as a pair-programming assistant for architecture planning, code generation, and implementation decisions.

### Exact Prompts

**Prompt 1 — Initial Architecture Planning:**
> "This is an empty directory, please complete the following assignment [full assignment text]. Associate Full-Stack Engineer: Take-Home Assignment..."

This was the initial prompt that kicked off the entire project. The AI generated a detailed implementation plan covering database schema, API design, project structure, and key design decisions for review before writing any code.

**Prompt 2 — Database Simplification:**
> "Can we put the database as Sqlite for the sake of simplicity and deployment"

I chose to simplify from PostgreSQL to SQLite since the project is a take-home assessment and SQLite eliminates the need for a separate database server. The AI updated the concurrency strategy from `SELECT...FOR UPDATE` to SQLite's WAL mode with IMMEDIATE transactions.

**Prompt 3 — Questioning AI's Design:**
> "Does sqlite provide a TTL feature, if yes then why do we need a cron job to clean things"

I challenged the AI's initial design that included a cron job for cleaning expired holds. The AI had incorrectly labeled the approach as "SQLite TTL" when SQLite has no such feature. After this challenge, the design was simplified to lazy cleanup — no background process needed. Expired holds are simply filtered out during queries and cleaned up opportunistically during new transactions.

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
