# ⚡ The Final Decrypt (CTF Arena)

> **Developed with ❤️ by IEEE NMIET RAS Developer Team**  
> **Core Developers: Shrikant & Anuj**

An advanced, interactive Capture The Flag (CTF) tournament platform engineered for real-time cybersecurity competitions, live scoreboard analytics, anti-cheat detection, and post-event debriefs.

---

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
The server and Vite client will start simultaneously on `http://localhost:3000`.

---

## 📚 Documentation for Developers & Challenge Authors (Shrikant & Anuj)

Shrikant & Anuj, Abhirup has left you full instructions, architecture breakdowns, and tools to build out the arena:

1. 🌌 **[Master Architecture, Workflow & System Scrutiny (A to Z)](file:///f:/Github/The-Final-Decrypt/PROJECT_OVERVIEW_A_TO_Z.md)**
   - Complete scrutiny of `server.ts` endpoints, functions, and middlewares.
   - SQLite persistent storage architecture (`ctf_database.sqlite`) and table schemas.
   - Anti-cheat DRM, constant-time flag comparison, and honeypot traps.
   - Context guide to reference when commanding Google Antigravity.

2. 🛡️ **[Challenge Developer & Security Guide](file:///f:/Github/The-Final-Decrypt/CHALLENGE_DEVELOPER_GUIDE.md)**
   - Complete JSON schema for challenges in [`questions.json`](file:///f:/Github/The-Final-Decrypt/questions.json)
   - How to add hints with point penalty costs
   - How to write step-by-step solutions for the **"POST-EVENT WRITEUP MODE"** (`RELEASE OFFICIAL WRITEUPS`)
   - Anti-copy and screenshot blackout protection details
   - Google Antigravity prompt cheatsheet to author challenges rapidly
