# 🛡️ Scam Shield (स्कैमशील्ड)

**Check it before you trust it.** Scam Shield is a real-time fraud intelligence assistant for Indian cyberspace. It scans suspicious messages, Instagram storefronts, and Telegram bots, delivering explainable risk verdicts, bilingual guidance, and emergency dispute tools.

> Built for **Algostorm 2.0** by **Debug Divas**

---

## 🌟 Flagship Capabilities

ScamShield blends deterministic rule-based heuristic engines, community blacklist databases, and vision-capable Large Language Models to deliver explainable, localized fraud protection:

1. **Bilingual Hindi & English (EN / हिंदी):**
   - Instant language toggle persisting across sessions.
   - Dual-language AI explanations (`summary_hi` & `action_steps_hi`) with natural Devanagari phrasing for Indian citizens.

2. **Digital Trust Report & Incident Assist:**
   - 0–100 risk scoring with segmented meter and provenance tags (`Rule Check`, `AI reading`, `Community Report`, `URL Analysis`).
   - Honest *Unverified Aspects* transparency disclosures.
   - 1-click **Copy Summary**, **Print / Save PDF Report**, and **Save to My History**.
   - **Incident Assist ("Already Paid? Don't panic"):** Emergency protocol covering the critical 120-minute *Golden Hour*, one-click dial/copy for helpline **`1930`** (National Cybercrime Reporting Portal), and a pre-formatted Bank Dispute Email/Letter generator.

3. **SellerCheck Flagging Workflow (Social Commerce Trust):**
   - Inspects Instagram shops for comments status (disabled / bot spam), account age bucket, and payment terms (100% advance UPI vs. COD).
   - Embedded "Before You Pay" 4-step consumer safety checklist.

4. **Learn Hub (Top 5 Indian Scam Playbooks):**
   - Dissects real-world fraud schemes: *Electricity Bill Disconnection SMS*, *Digital Arrest (CBI/Police Video Call)*, *SBI YONO KYC Phishing*, *YouTube Task Scam*, and *Customs Courier Clearance Fee*.
   - Includes full anatomy, red flags, and a **"Test this sample in Scanner"** button for interactive learning.

5. **Guest-First Auth & Scan History:**
   - Zero-barrier scanning: no mandatory password or account sign-up.
   - Generates persistent guest profiles with optional nickname.
   - Full "My History" side drawer to reopen, review, and manage past evaluations, backed by local storage and SQLite.

---

## 🔍 What Scam Shield Checks

| Check | Input | What it looks for |
|---|---|---|
| **Email / SMS** | Screenshot or pasted text | Urgency pressure, OTP/PIN requests, upfront fees, prize and refund bait, KYC threats, shortened or look-alike links, brand impersonation |
| **Instagram shop** | Profile screenshots, or typed-in numbers, plus optional UPI ID and phone | Engagement far below follower count, big audience with few posts, generic comments, advance-only or UPI-only payment, no business details, replica pricing |
| **Telegram bot** | Bot username, link or the message it sent | Look-alike usernames, airdrop and giveaway bait, "connect wallet" prompts, "send 1 get 2x" offers, guaranteed returns |
| **Community reports** | Any UPI ID, phone, handle or link | Shows "reported N times" when others have flagged the same entity |

Every result includes a **0-100 risk score**, a **verdict** (Low risk / Suspicious / High risk), the **specific signals** behind it, and **what to do next**.

---

## 🏗️ Architecture & Pipeline

```
 Screenshot / text / username
            │
            ▼
 ┌──────────────────────┐
 │  Next.js frontend    │   (Bilingual UI, Incident Assist, History Drawer)
 └──────────┬───────────┘
            │ HTTPS (multipart / JSON)
            ▼
 ┌──────────────────────────────── FastAPI backend ───────────────────────────────┐
 │                                                                                │
 │  1. Vision LLM (OpenRouter / Ollama) → extracts structured JSON from media     │
 │  2. Rules engine                     → deterministic red-flag checks + URLs    │
 │  3. Community reports (SQLite)       → UPI / phone / handle blacklist lookups  │
 │  4. Score fusion                     → fused explainable 0-100 score           │
 │  5. LLM explainer                    → bilingual English & Devanagari Hindi    │
 │                                                                                │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
scamshield/
├── frontend/                     # Next.js 14 (Pages Router)
│   ├── components/
│   │   ├── ResultCard.js         # Digital Trust Report with provenance & print actions
│   │   ├── IncidentAssistModal.js# Golden Hour checklist & dispute letter generator
│   │   ├── AuthModal.js          # Guest session profile management
│   │   └── HistoryDrawer.js      # Scan history drawer with reopen & delete actions
│   ├── context/
│   │   └── LanguageContext.js    # Persistent EN/HI language context
│   ├── lib/
│   │   ├── api.js                # Frontend API client with proxy & direct fallback
│   │   └── translations.js       # English & Hindi translation dictionaries & playbooks
│   ├── pages/
│   │   ├── _app.js               # App shell with LanguageProvider
│   │   ├── _document.js          # Font optimization
│   │   └── index.js              # 5-tab main application
│   └── styles/
│       └── globals.css           # Design tokens, modal/drawer styling, print layout
│
└── backend/                      # FastAPI Microservice
    ├── main.py                   # REST API endpoints & analysis pipeline
    ├── rules.py                  # Deterministic heuristics, regexes, lookalike checks
    ├── llm.py                    # Vision extraction & bilingual explainer prompts
    └── store.py                  # SQLite database for community reports & scan history
```

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Optional: Add OPENROUTER_API_KEY in .env. If left blank, local Ollama or rule fallbacks run seamlessly.

# Start FastAPI server
uvicorn main:app --reload --port 8001
```

* Backend health check: [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health)  
* Interactive API Docs (Swagger): [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

Visit the application at: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Safe Demo Samples (No API Key Required)

You can demonstrate all features using deterministic mock signals:

* **Email / SMS Tab:**
  > `URGENT: Your SBI account will be blocked in 24 hours. Update KYC at http://sbi-kyc-update.xyz and share your OTP with officer.`
* **Instagram / SellerCheck Tab:**
  > Username: `demo_fake_shop`, Followers: `45,000`, Likes: `15`, Comments Status: `Disabled`, Payment: `100% Advance / UPI-only`.
* **Telegram Tab:**
  > `@demo_airdrop_bot Claim free 500 USDT! Connect wallet now at http://bit.ly/claim-airdrop`
* **Community Report Lookup:**
  > UPI ID: `demo.fakeshop@upi` or Phone: `9999900001` (triggers community blacklist signals).

---

## 🔒 Security & Ethics

* All analyzed user data is processed ephemeral without being indexed for public browsing.
* Results are risk assessments based on observable indicators and heuristic matches, not accusations or definitive legal judgments.
* Always independently verify via primary banking helplines before undertaking financial decisions.

---

## 👥 Team

| Name | Role |
|---|---|
| Honey | Core Developer |
| Siya | Core Developer |
| Astha | Core Developer |

---

## 📄 License

This project is licensed under the MIT License.
