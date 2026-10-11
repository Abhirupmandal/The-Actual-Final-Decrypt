# 🌌 THE FINAL DECRYPT — Master Architecture, Workflow & System Scrutiny (A to Z)

> **Developed with ❤️ by IEEE NMIET RAS Developer Team**  
> **Dedicated Master Documentation for Shrikant & Anuj**  
> *Comprehensive system scrutiny, function breakdowns, security architecture, data pipelines, and developer context.*

---

## 🧭 Executive Summary & Project Context

### What is The Final Decrypt?
**The Final Decrypt** is an enterprise-grade, cyber-defense styled Capture The Flag (CTF) tournament arena built from scratch for high-concurrency, real-time competitive hacking and cryptographic decryption events.

The platform was architected by **Abhirup** for the **IEEE NMIET RAS Developer Team**. This master document is created specifically for **Shrikant and Anuj** so you can immediately understand every layer of the architecture, inspect every function, understand the data flows, and command **Google Antigravity** to expand the system with zero confusion.

---

## 🏗️ 1. High-Level Technology Stack

```mermaid
graph TD
    Client[React 18 + Vite + TailwindCSS Client] <-->|HTTP REST APIs| Server[Node.js + Express Server (TypeScript)]
    Client <-->|WebSocket Bidirectional State| Socket[Socket.IO Server Engine]
    Server <-->|Memory-Hard Scrypt & HMAC| Crypto[Crypto Security Subsystem]
    Server <-->|In-Memory Cache & Token Bucket| RateLimit[Tiered Rate Limiter + Redis Cache]
    Server <-->|ACID Transactions| SQLite[(SQLite 3 WebAssembly: ctf_database.sqlite)]
    Server <-->|Hot Sync Engine| Questions[questions.json Master Seed]
```

| Layer | Technologies Used | Primary Responsibilities |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons | Responsive HUD, Canvas Matrix Rain, Web Audio Synthesizer sound effects, modal gates, leaderboard. |
| **Real-Time Layer** | Socket.IO | Instant scoreboard sync, real-time live activity feed, push broadcast announcements, screenshot alerts. |
| **Backend API** | Node.js, Express (TypeScript), `express-rate-limit` | REST endpoints, RBAC authentication, input validation, timer authoritativeness, flag evaluation. |
| **Database & Persistence** | SQLite 3 (`sql.js` WASM), JSON disk backups | Persistent storage of squads, challenges, submissions, security logs, audit trails, and feedback. |
| **Security & DRM** | Crypto (`node:crypto`), Zod, Custom DRM Curtains | Anti-screenshot blackout, clipboard lockdown, constant-time flag comparison, scrypt hashing, honeypot 404 traps. |

---

## 🔄 2. Complete End-to-End Workflow (A to Z)

### Phase 1: Team Registration & Onboarding
1. **Squad Signup (`POST /api/auth/signup`)**:
   - The team registers with `teamName`, `email`, `password`, and 1–4 `members`.
   - **Validation:** [`TeamSignupSchema`](file:///f:/Github/The-Final-Decrypt/src/security/validation.ts#L45-L68) (Zod) validates email syntax, minimum 8-character password with letters and numbers, and clean team names.
   - **Rate Limiting:** Guarded by `checkRateLimitTier('TEAM_AUTH', ip)`.
   - **Duplicate Checks:** Inverted indices check both case-insensitive team names and email addresses to strictly prohibit multi-accounting.
   - **Password Security:** Salted and hashed using memory-hard `scrypt` (`hashPassword` in [`cryptoSession.ts`](file:///f:/Github/The-Final-Decrypt/src/security/cryptoSession.ts#L104-L122)).
   - **Token Generation:** Produces a cryptographically signed HMAC-SHA256 session token (`createSignedToken('team', team.id)`).

2. **Pre-Competition Readiness Gate ([`PreCompetitionGate.tsx`](file:///f:/Github/The-Final-Decrypt/src/components/PreCompetitionGate.tsx))**:
   - Before viewing any challenge cards, all registered squads enter the pre-competition briefing chamber.
   - Teams run a sound synthesizer test, review proctoring rules, and click **"CONFIRM SQUAD READY & ENTER ARENA"**.
   - Triggers `POST /api/team/ready`, updating squad status to `hasStarted = true`.

---

### Phase 2: Live Competition & Arena Gameplay
1. **Challenge Browsing & Quarantine**:
   - Challenges are categorized into **Section A (Find the Clue, Find the Key)** and **Section B (The Decode Chamber)** across `CRYPTO`, `STEGO`, `FORENSICS`, `WEB`, `REV`, `OSINT`, `AUDIO`, and `MISC`.
   - **Zero Client Leakage:** The backend function [`getPublicChallengesForTeam()`](file:///f:/Github/The-Final-Decrypt/server.ts#L396-L437) maps challenges into public views:
     - `c.flag` is **never sent**.
     - `c.writeup` is **omitted (`undefined`)** during the live contest.
     - `c.hints[].content` is **masked as `undefined`** until unlocked.

2. **Hint Purchasing Pipeline (`POST /api/unlock-hint`)**:
   - Teams inspect a hint title and penalty cost (e.g., `-30 pts`).
   - If the team confirms the unlock, the backend records the hint ID under `team.hintsUnlocked[challengeId]`.
   - The hint penalty is deducted from the challenge reward upon final decryption.
   - An event is dispatched to the live activity feed (`hint_unlocked`).

3. **Flag Submission Pipeline (`POST /api/submit-flag`)**:
   ```mermaid
   sequenceDiagram
       participant Student as Student Squad
       participant Server as Express Server
       participant SQLite as SQLite Database
       participant Sockets as WebSocket Broadcast

       Student->>Server: POST /api/submit-flag (challengeId, flag)
       Server->>Server: Verify Team Token & Rate Limits (5 attempts/10s)
       Server->>Server: Check Max Attempts Remaining (default: 5)
       Server->>Server: Constant-Time SHA-256 Compare (crypto.timingSafeEqual)
       alt Correct Flag
           Server->>Server: Detect First Blood (First solver gets +50 pts bonus)
           Server->>SQLite: Record Submission & Award Points (Base - Hint Penalties + Bonus)
           Server->>Sockets: Emit 'solve' or 'first_blood' Activity Event
           Server->>Sockets: Emit 'state_update' & 'leaderboard' to all screens
           Server-->>Student: 200 OK (FLAG ACCEPTED!)
       else Incorrect Flag
           Server->>SQLite: Increment failedAttempts count
           Server->>Server: Lock challenge if attempts >= maxAttempts
           Server-->>Student: 400 Bad Request (INCORRECT FLAG)
       end
   ```

4. **Telemetry & Anti-Cheat Fair Play DRM ([`SecurityGuard.tsx`](file:///f:/Github/The-Final-Decrypt/src/components/SecurityGuard.tsx))**:
   - **Anti-Copy:** CSS `user-select: none !important` stops text highlighting. Event listeners intercept `copy`, `cut`, `selectstart`, and `contextmenu` (right click).
   - **Anti-Screenshot Blackout:** Key combinations (`Win + Shift + S`, `PrintScreen`, `Ctrl + Shift + S`, `Alt + PrintScreen`) trigger:
     - An instant full-screen blackout curtain (`#000000`).
     - Warning alarm tone synthesis.
     - Strike telemetry transmission to `POST /api/telemetry/screenshot`.
     - An alert banner in the top-right corner warning the squad.

---

### Phase 3: Post-Competition & Writeup Release
1. **Countdown Expiration**: The server-authoritative timer decrements automatically every second. When remaining seconds reach 0, `competitionState.status` transitions to `'ended'`, automatically locking flag submissions.
2. **Post-Event Writeup Mode**:
   - In the **Admin Portal**, an organizer clicks **`RELEASE OFFICIAL WRITEUPS`**.
   - Endpoint `POST /api/admin/writeup-mode` sets `competitionState.writeupMode = true` and persists it to SQLite.
   - The server triggers `broadcastState()`.
   - Now, [`getPublicChallengesForTeam()`](file:///f:/Github/The-Final-Decrypt/server.ts#L434) sends `c.writeup` to all client screens.
   - Every challenge modal unlocks a dedicated **"Official Solution & Walkthrough"** tab for post-event education.
3. **Student Feedback System ([`FeedbackModal.tsx`](file:///f:/Github/The-Final-Decrypt/src/components/FeedbackModal.tsx))**:
   - A friendly feedback prompt asks 7 tailored questions rating UI, difficulty, stability, and suggestions.
   - Persisted to SQLite table `user_feedbacks` via `POST /api/feedback`.

---

## 📂 3. Codebase File Structure & Deep Scrutiny

```
f:\Github\The-Final-Decrypt\
├── server.ts                       # Master Express Server, WebSocket Engine & API Routes
├── questions.json                  # Master challenge seed file (JSON)
├── package.json                    # Project metadata & dependencies
├── tsconfig.json                   # TypeScript compiler configuration
├── vite.config.ts                  # Vite development & build configuration
├── CHALLENGE_DEVELOPER_GUIDE.md    # Dedicated guide for Shrikant & Anuj on challenges & hints
├── PROJECT_OVERVIEW_A_TO_Z.md      # THIS FILE: Master architecture & technical scrutiny
├── README.md                       # Repository overview & quick start
├── data/
│   ├── ctf_database.sqlite         # SQLite 3 Persistent Database File
│   └── session_secret.key          # Persistent 256-bit HMAC secret
└── src/
    ├── types.ts                    # Complete TypeScript interfaces & domain models
    ├── main.tsx                    # React client entry point
    ├── App.tsx                     # Top-level client state, sockets, and view router
    ├── index.css                   # Global styling, cyber themes, DRM CSS locks
    ├── database/
    │   └── persistentStore.ts      # SQLite DAO layer (teams, challenges, submissions, logs)
    ├── security/
    │   ├── cryptoSession.ts        # HMAC tokens, scrypt password hashing, timing-safe checks
    │   ├── validation.ts           # Zod schemas, input sanitization, HTML escaping
    │   ├── rateLimiter.ts          # Tiered in-memory token bucket rate limiter
    │   ├── expressRateLimitRedis.ts# Express middleware rate limiting with Redis support
    │   ├── redisCache.ts           # Redis client with in-memory fallback
    │   └── fileSecurity.ts         # Attachment extension whitelisting & safe download headers
    ├── components/
    │   ├── Header.tsx              # Top navigation bar, timer HUD, strikes badge, team profile
    │   ├── AdminPortal.tsx         # Organizer management dashboard & competition command HQ
    │   ├── ChallengeCard.tsx       # Challenge card display with category badges & point values
    │   ├── ChallengeModal.tsx      # Challenge details, attachments, hint purchases & flag submission
    │   ├── Leaderboard.tsx         # Scoreboard with tie-breakers, ranks & champion crowns
    │   ├── ActivityFeed.tsx        # Real-time WebSocket activity timeline
    │   ├── SecurityGuard.tsx       # Anti-copy, screenshot blackout & DevTools proctoring DRM
    │   ├── PreCompetitionGate.tsx  # Pre-event team readiness gate & sound check
    │   ├── FeedbackModal.tsx       # 7-question post-event feedback survey
    │   ├── StrikeWarningBanner.tsx # Top-right screenshot infraction warning banner
    │   ├── StrikeWarningModal.tsx  # Disqualification / Arbitration incident modal
    │   └── MatrixRain.tsx          # Dynamic Canvas Matrix digital rain animation
    └── utils/
        └── audio.ts                # Web Audio API 8-bit cyber sound effects synthesizer
```

---

## 🔍 4. In-Depth Scrutiny of Key Components & Functions

### A. Master Server (`server.ts`)

#### 1. Global Security Hardening
- **`app.disable('x-powered-by')`**: Strips Express headers to prevent server fingerprinting.
- **OWASP Headers Middleware ([`server.ts:L84-L92`](file:///f:/Github/The-Final-Decrypt/server.ts#L84-L92))**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

#### 2. Authentication & Authorization Middlewares
- **`requireAdminAuth(req, res, next)` ([`server.ts:L718`](file:///f:/Github/The-Final-Decrypt/server.ts#L718))**:
  - Reads `x-admin-token` or `Bearer` token.
  - Verifies cryptographic signature using [`verifySignedToken()`](file:///f:/Github/The-Final-Decrypt/src/security/cryptoSession.ts#L69).
  - Validates `payload.role === 'admin'`. Rejects with `403 Forbidden` if missing or tampered.
- **`requireTeamAuth(req, res, next)` ([`server.ts:L745`](file:///f:/Github/The-Final-Decrypt/server.ts#L745))**:
  - Validates squad session tokens, binds the verified `team` object to `req.team`.

#### 3. Core Challenge Sync Engine
- **`challengeStore.syncFromQuestionsJson(path)` ([`server.ts:L442`](file:///f:/Github/The-Final-Decrypt/server.ts#L442))**:
  - Reads [`questions.json`](file:///f:/Github/The-Final-Decrypt/questions.json), validates structure, and performs an atomic SQLite upsert.
  - Exposes an admin endpoint `POST /api/admin/challenges/sync-questions` ([`server.ts:L2519`](file:///f:/Github/The-Final-Decrypt/server.ts#L2519)) so Shrikant and Anuj can hot-reload challenge changes live!

#### 4. Stealth Honeypot 404 Route Trap ([`server.ts:L262-L282`](file:///f:/Github/The-Final-Decrypt/server.ts#L262-L282))
- Standard administrative probe paths (`/admin`, `/wp-admin`, `/cpanel`, `/admin.php`, `/portal/admin`) are intercepted.
- Instead of returning a real 403 or redirect, the server returns an authentic, generic HTML 404 while silently logging an `ADMIN_PROBE_BLOCKED` security event with the intruder's IP.

---

### B. Persistent Database Layer (`src/database/persistentStore.ts`)

Built using **SQLite 3 WebAssembly (`sql.js`)** running in-memory with debounced, non-blocking disk syncs to [`data/ctf_database.sqlite`](file:///f:/Github/The-Final-Decrypt/data/ctf_database.sqlite).

| Store Class | SQLite Table | Description |
| :--- | :--- | :--- |
| `SqliteTeamStore` | `teams` | Stores team credentials, scrypt password hashes, salt, score, solves dictionary, unlocked hints, failed attempts, and strikes. |
| `SqliteChallengeStore` | `challenges` | Stores all challenges, categories, points, flags, hint JSON arrays, and writeup JSON objects. |
| `SqliteSubmissionStore` | `submissions` | Full audit log of every flag submission attempt (flag string, timestamp, IP, isCorrect, points). |
| `SqliteLeaderboardStore` | `leaderboard`, `leaderboard_snapshots` | Evaluated rankings, historical score snapshots for tie-break audits. |
| `SqliteSecurityLogStore` | `security_logs` | Security events (rate limits, honeypot probes, velocity anomalies, screenshot warnings). |
| `SqliteAuditLogStore` | `audit_logs` | Microsecond-precision audit trail for student actions (login, flag, hint) and admin actions (timer, disqualification). |
| `SqliteFeedbackStore` | `user_feedbacks` | Post-event participant feedback submissions. |

---

### C. Security & Cryptography Subsystem (`src/security/`)

#### 1. Cryptographic Sessions ([`cryptoSession.ts`](file:///f:/Github/The-Final-Decrypt/src/security/cryptoSession.ts))
- **`createSignedToken(role, subjectId, durationMs, operatorName)`**:
  - Encodes payload as `base64url`.
  - Computes `HMAC-SHA256(payload, SESSION_SECRET)`.
  - Format: `<payload>.<signature>`.
- **`verifySignedToken(token)`**:
  - Splits `<payload>.<signature>`.
  - Computes expected HMAC and compares using `crypto.timingSafeEqual` to eliminate timing side-channels.
  - Checks `Date.now() > payload.expiresAt`.
- **`hashPassword(password)` & `verifyPassword(password, salt, expectedHash)`**:
  - Uses `crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })` for memory-hard key derivation.

#### 2. Input Validation ([`validation.ts`](file:///f:/Github/The-Final-Decrypt/src/security/validation.ts))
- Uses **Zod** for strict type coercion and regex constraints.
- **`sanitizeInput(str)`**: Strips control characters, normalizes Unicode, and replaces HTML special characters (`<`, `>`, `"`, `'`, `/`, `&`) with safe HTML entities to prevent XSS.

#### 3. File Attachment Security ([`fileSecurity.ts`](file:///f:/Github/The-Final-Decrypt/src/security/fileSecurity.ts))
- **Strict Extension Whitelist:** `.png`, `.jpg`, `.wav`, `.mp3`, `.txt`, `.log`, `.py`, `.c`, `.cpp`, `.bin`, `.raw`, `.pcap`, `.zip`, `.json`, `.dump`.
- **Strict Blacklist:** Executables and active script extensions (`.exe`, `.sh`, `.bat`, `.svg`, `.html`, `.php`, etc.) are rejected with security violations.
- **Size Limitation:** Maximum threshold of 5 MB per attachment.

---

### D. Client-Side User Experience & Anti-Cheat DRM

#### 1. Top Navigation Bar ([`Header.tsx`](file:///f:/Github/The-Final-Decrypt/src/components/Header.tsx))
- **Live Countdown Timer:** Displays remaining time with visual urgency (turns amber/red under 10 minutes).
- **Strikes Badge:** Displays `WARNINGS: {count}` with dynamic pulse animation.
- **Team Identity Pill:** Shows team name and score with instant sign-out controls.

#### 2. Anti-Screenshot Blackout Guard ([`SecurityGuard.tsx`](file:///f:/Github/The-Final-Decrypt/src/components/SecurityGuard.tsx))
- Listens to global `keydown` and `keyup` window events.
- Intercepts Snipping Tool (`Win + Shift + S`), PrintScreen (`PrintScreen`), and browser save shortcuts (`Ctrl + S`, `Ctrl + Shift + S`).
- Instantly toggles pitch-black blackout overlay:
  ```tsx
  <div className="fixed inset-0 z-[999999] bg-black pointer-events-auto flex items-center justify-center">
    ...
  </div>
  ```
- Emits telemetry to `/api/telemetry/screenshot` which increments the team's strike count.

---

## 🚀 5. How Shrikant & Anuj Should Use Google Antigravity

Whenever **Shrikant and Anuj** are working on challenges, UI updates, or backend enhancements, you can simply instruct Google Antigravity like this:

### Example Prompt 1: Adding a New Challenge & Writeup
```text
Hey Antigravity, following PROJECT_OVERVIEW_A_TO_Z.md and CHALLENGE_DEVELOPER_GUIDE.md, please add a new Web Exploitation challenge to questions.json:
- Title: "JWT None Algorithm Bypass"
- Category: "WEB"
- Points: 200
- Difficulty: "Medium"
- Add 2 hints with appropriate costs (15 pts and 30 pts)
- Include a full step-by-step writeup
- Ensure the challenge syncs to SQLite without restarting the server.
```

### Example Prompt 2: Updating Anti-Cheat or Timer Controls
```text
Hey Antigravity, refer to PROJECT_OVERVIEW_A_TO_Z.md section 4.A for server.ts timer and strike management. Please adjust the timer controls to allow quick 15-minute extensions from the Admin Portal.
```

---

## 👥 Credits & Team Information

- **Founder & System Architect:** Abhirup Mandal
- **Core Developers & Challenge Architects:** Shrikant & Anuj
- **Team:** IEEE NMIET RAS Developer Team
- **Competition:** The Final Decrypt (CTF Arena)

*Happy coding, Shrikant & Anuj! This platform is built for you to lead and innovate.* 🛡️⚡
