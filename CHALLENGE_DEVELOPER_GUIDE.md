# 🛡️ THE FINAL DECRYPT — Challenge Developer & Security Guide
> **Developed with ❤️ by IEEE NMIET RAS Developer Team**  
> **Dedicated Guide for Lead Developers & Friends: Shrikant & Anuj**  
> *Official instruction guide for authoring CTF challenges, configuring hints, attaching writeups, and maintaining strict anti-cheat integrity using Google Antigravity.*

---

### 👋 A Special Note from Abhirup:
> *"Hey Shrikant & Anuj! 👋 Hope you guys are doing awesome! **Abhirup has left you some exciting work to do on this project!** 💻🔥*  
> *The entire battle platform, real-time scoreboard, anti-copy DRM, and database synchronization are already set up and rock solid. Now it's your time to shine:*  
> *- Craft high-octane challenge questions across Cryptography, Steganography, Web, and Forensics.*  
> *- Add clever progressive hints with point penalties.*  
> *- Write crystal-clear solution walkthroughs that get revealed when the Admin hits the post-event writeup button.*  
> *Google Antigravity is right here in your editor pair-programming with you. You've got this, boys! Let's make this CTF unforgettable!"*

---

> 📖 **ESSENTIAL PREREQUISITE FOR SHRIKANT & ANUJ:**  
> Before diving into challenge creation, **please read the complete A-to-Z project architecture and technical scrutiny guide:**  
> 👉 **[PROJECT_OVERVIEW_A_TO_Z.md](file:///f:/Github/The-Final-Decrypt/PROJECT_OVERVIEW_A_TO_Z.md)**  
> *(Covers the entire tech stack, functions in `server.ts`, database schemas, anti-cheat DRM, and Antigravity workflow context!)*

---

## 📌 1. Welcome Shrikant & Anuj! Overview & Architecture

Welcome to the command deck, **Shrikant** and **Anuj**! This repository powers **The Final Decrypt**, an interactive, cyber-defense styled Capture The Flag (CTF) arena.

As our challenge architects and platform developers, whenever you work with **Google Antigravity**, you will:
1. Add new challenges across categories (Crypto, Stego, Web, Forensics, Rev, OSINT, Audio, Misc).
2. Configure **hints** with specific point deduction costs.
3. Provide **official writeups** and solutions for post-event debriefs.
4. Ensure **zero leakage and strict anti-copy protection** so students cannot copy, inspect, or cheat during the live contest.

### Where Challenge Data Lives:
- **Seed & Configuration File:** [`questions.json`](file:///f:/Github/The-Final-Decrypt/questions.json) (Root directory).
- **Persistent Database:** SQLite database at [`data/ctf_database.sqlite`](file:///f:/Github/The-Final-Decrypt/data/ctf_database.sqlite) (`challenges` table).
- **Automatic Sync:** Whenever the server boots or the Admin sync endpoint is triggered, `questions.json` automatically upserts into SQLite.

---

## 🔐 2. Anti-Copy & Anti-Cheat Fair Play Guarantees

Before creating challenges, understand how the platform protects your challenge text, hints, flags, and writeups:

### A. Zero Backend Leakage (Server-Side Isolation)
| Element | Student View During Contest | Admin / Post-Event View |
| :--- | :--- | :--- |
| **Flag (`c.flag`)** | **NEVER sent to client.** Handled strictly on backend (`POST /api/flags/submit`). | Only visible in Admin Portal. |
| **Hints (`c.hints[].content`)** | Masked as `undefined` until the team deliberately spends points to unlock that hint. | Unmasked upon point penalty purchase. |
| **Writeups (`c.writeup`)** | **Completely stripped (`undefined`)** from all API payloads while the contest is active. | Exposed only when Admin toggles **"RELEASE OFFICIAL WRITEUPS"**. |

### B. Client-Side DRM & Anti-Copy Lockdown
1. **Selection Disabled:** `user-select: none !important` across all student screens stops mouse highlighting and dragging.
2. **Clipboard Interception:** Native browser events for `copy`, `cut`, and `selectstart` are cancelled with `e.preventDefault()`.
3. **Context Menu Blocked:** Right-clicking anywhere on the challenge board is disabled.
4. **DevTools Key Blocking:** `F12`, `Ctrl + Shift + I`, `Ctrl + Shift + J`, `Ctrl + U` (View Source), and `Ctrl + S` are intercepted and blocked.
5. **Anti-Screenshot Blackout Curtain:** Pressing `PrintScreen`, `Win + Shift + S`, or `Ctrl + Shift + S` triggers an instant pitch-black overlay, sounds an alert, and registers a violation strike against the offending team.

---

## 📝 3. Challenge JSON Schema

Every challenge in [`questions.json`](file:///f:/Github/The-Final-Decrypt/questions.json) follows this standard schema:

```json
{
  "id": "chal-09",
  "title": "Quantum Lattice Key Exchange",
  "section": "Section A (Find the Clue, Find the Key)",
  "category": "CRYPTO",
  "points": 250,
  "difficulty": "Hard",
  "description": "An intercepted key exchange protocol exhibits a deterministic flaw in its polynomial reduction. Recover the shared ephemeral secret to compute the flag.",
  "flag": "CTF{l4tt1c3_r3duct10n_br34k_2026}",
  "flagFormat": "CTF{...}",
  "maxAttempts": 5,
  "attachment": {
    "fileName": "exchange_capture.pcap",
    "mimeType": "application/vnd.tcpdump.pcap",
    "size": "24.5 KB",
    "content": "RAW_PCAP_STREAM_CONTENT_BASE64_OR_TEXT"
  },
  "hints": [
    {
      "id": "h1",
      "title": "Module Factorization",
      "cost": 30,
      "content": "Notice the modulus q = 12289 is small enough for Babai's Closest Vector Problem (CVP) solver."
    },
    {
      "id": "h2",
      "title": "Reduction Basis",
      "cost": 50,
      "content": "Use SageMath's LLL reduction on the 2x2 matrix defined by the public vectors."
    }
  ],
  "writeup": {
    "summary": "Exploiting weak modulus in lattice key exchange using LLL reduction.",
    "steps": [
      "1. Extracted public parameters (A, b) from packet #14.",
      "2. Set up the dual lattice basis in SageMath with q=12289.",
      "3. Ran LLL reduction to find the shortest non-zero vector.",
      "4. Recovered ephemeral secret s = [3, -1, 4, 2].",
      "5. Computed AES key and decrypted flag: CTF{l4tt1c3_r3duct10n_br34k_2026}."
    ]
  }
}
```

### Field Definitions:
- **`id`** *(string, required)*: Unique slug (e.g., `chal-01`, `chal-02`, etc.).
- **`title`** *(string, required)*: Display title on the challenge card.
- **`section`** *(string, required)*: Either `"Section A (Find the Clue, Find the Key)"` or `"Section B (The Decode Chamber)"`.
- **`category`** *(string, required)*: One of `CRYPTO`, `STEGO`, `FORENSICS`, `WEB`, `REV`, `OSINT`, `AUDIO`, `MISC`.
- **`points`** *(number, required)*: Score awarded upon successful flag submission (e.g., `100`, `250`, `400`).
- **`difficulty`** *(string, required)*: `"Easy"`, `"Medium"`, or `"Hard"`.
- **`description`** *(string, required)*: Scenario narrative and instructions for the participant.
- **`flag`** *(string, required)*: The exact secret flag string (e.g., `CTF{...}`). Case-sensitive matching.
- **`flagFormat`** *(string, required)*: Placeholder clue displayed in input box (e.g., `CTF{...}`).
- **`maxAttempts`** *(number, required)*: Maximum wrong guesses before challenge locks (standard: `5`).
- **`attachment`** *(object, optional)*:
  - `fileName`: Display name of the file.
  - `mimeType`: MIME type (e.g., `text/plain`, `image/png`, `application/json`).
  - `size`: Human-readable size string (e.g., `"14.2 KB"`).
  - `content`: File text payload or base64 data for participant download.
- **`hints`** *(array of objects)*:
  - `id`: Unique identifier (e.g., `h1`, `h2`).
  - `title`: Short hint name displayed before purchase.
  - `cost`: Points deducted from team score when unlocked.
  - `content`: The hint text (kept strictly hidden until bought).
- **`writeup`** *(object, required)*:
  - `summary`: High-level explanation of the vulnerability or mechanism.
  - `steps`: Step-by-step numbered breakdown of how to solve the challenge.

---

## 📖 4. Post-Event Writeup Mode

![Post-Event Writeup Mode in Admin Portal](file:///C:/Users/Abhirup/.gemini/antigravity-ide/brain/8c45554a-a726-4ee3-986d-96951b2c0250/.user_uploaded/media_1791705734667.png)

### How it works:
1. Log in to the **Admin Portal** using the Master Access Token.
2. In the **Control HQ** tab, locate **"POST-EVENT WRITEUP MODE"**.
3. **During the competition:** The toggle status is `LOCKED`. All challenge writeups and solution steps are stripped by the backend. Students see only challenges, attachments, and purchased hints.
4. **After the competition ends:** Click **`RELEASE OFFICIAL WRITEUPS`**.
5. The button transitions to **`LOCK WRITEUPS`** (`UNLOCKED` state).
6. The server immediately broadcasts the state change via WebSocket. All participant screens instantly unlock an **"Official Solution & Walkthrough"** section inside every challenge modal, displaying the exact derivation steps, formulas, and educational debrief!
7. If you ever need to hide the writeups again, simply click **`LOCK WRITEUPS`**.

---

## 🤖 5. Working with Google Antigravity (Prompt Cheatsheet)

When you are authoring or updating challenges with Antigravity, use these tested prompts:

### Prompt 1: Add a New Challenge to `questions.json`
```text
Please add a new challenge to questions.json with the following parameters:
- ID: chal-10
- Title: Matrix Polynomial Cipher
- Section: Section B (The Decode Chamber)
- Category: CRYPTO
- Points: 300
- Difficulty: Hard
- Description: [Insert prompt description]
- Flag: CTF{m4tr1x_c1ph3r_k3y_s0lv3d}
- Flag Format: CTF{...}
- Hints:
  1. Title: Determinant Analysis, Cost: 25, Content: Calculate det(M) mod 256.
  2. Title: Modular Inverse, Cost: 50, Content: The matrix inverse exists only if gcd(det, 256) == 1.
- Writeup:
  - Summary: Hill cipher variant over GF(256).
  - Steps: [1. Compute matrix inverse mod 256, 2. Multiply ciphertext vectors, 3. Reveal flag].

Ensure strict JSON validity and sync with persistent SQLite storage.
```

### Prompt 2: Update Existing Hints & Penalties
```text
In questions.json, please update challenge 'chal-04':
- Change hint 'h2' cost to 35 points.
- Clarify the hint content to mention: "Check HTTP Authorization headers for JWT bearer token."
- Add a 3rd step to the writeup detailing the base64url decoding command.
```

### Prompt 3: Verify Anti-Copy & Fair-Play Integrity
```text
Please check that no challenge in questions.json has its flag or writeup leaked to the client during live play. Confirm that getPublicChallengesForTeam in server.ts properly hides writeup when writeupMode is false.
```

---

## ⚡ 6. How to Apply & Sync Changes

After editing or adding challenges in [`questions.json`](file:///f:/Github/The-Final-Decrypt/questions.json):

1. **Automatic Sync on Restart:** If you reboot the development server (`npm run dev`), the server automatically runs `challengeStore.syncFromQuestionsJson()` and populates the SQLite database.
2. **Live Hot Sync (Without Restarting):**
   - In the **Admin Portal**, click **"Sync Challenges"**, or
   - Send an authenticated HTTP request:
     ```bash
     curl -X POST http://localhost:3000/api/admin/challenges/sync-questions \
          -H "x-admin-token: <YOUR_ADMIN_TOKEN>"
     ```
   - This reloads all questions from `questions.json`, saves them directly into `ctf_database.sqlite`, and broadcasts the live update to all connected teams instantly!

---

## 👥 Need Help?
- **Lead Developers:** Shrikant & Anuj
- **Team:** IEEE NMIET RAS Developer Team
- **Project:** The Final Decrypt
- For questions or support, reach out to your lead or pair program directly with **Google Antigravity**! Happy hacking, Shrikant & Anuj! 🚀
