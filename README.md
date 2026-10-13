# 🛡️ Scam Shield

**Check it before you trust it.** Scam Shield scans suspicious messages, Instagram shops and Telegram bots, then gives a risk score with plain-language reasons.

> Built for [Algostorm 2.0] by [Debug Divas]

---

## The problem

Online scams in India no longer look like bad-grammar emails from strangers. They arrive as:

- **Phishing emails and SMS** that imitate banks, wallets and delivery companies
- **Fake Instagram shops** with thousands of followers and bought engagement, which take advance payment on UPI and never deliver
- **Telegram bots and "task" groups** that promise airdrops, easy income or guaranteed returns, then drain wallets or collect deposits

Existing tools cover calls and links. Almost nothing helps an ordinary person judge whether a small online shop or a Telegram bot is real before they pay.

## What Scam Shield does

| Check | Input | What it looks for |
|---|---|---|
| **Email / SMS** | Screenshot or pasted text | Urgency pressure, OTP/PIN requests, upfront fees, prize and refund bait, KYC threats, shortened or look-alike links, brand impersonation |
| **Instagram shop** | Profile screenshots, or typed-in numbers, plus optional UPI ID and phone | Engagement far below follower count, big audience with few posts, generic comments, advance-only or UPI-only payment, no business details, replica pricing |
| **Telegram bot** | Bot username, link or the message it sent | Look-alike usernames, airdrop and giveaway bait, "connect wallet" prompts, "send 1 get 2x" offers, guaranteed returns |
| **Community reports** | Any UPI ID, phone, handle or link | Shows "reported N times" when others have flagged the same entity |

Every result includes a **0-100 risk score**, a **verdict** (Low risk / Suspicious / High risk), the **specific signals** behind it, and **what to do next**.

Results are worded as *risk indicators*, never as an accusation. Scam Shield cannot prove that someone is a scammer.

---

## How it works

```
 Screenshot / text / username
            │
            ▼
 ┌──────────────────────┐
 │  Next.js frontend    │
 └──────────┬───────────┘
            │ HTTPS (multipart / JSON)
            ▼
 ┌──────────────────────────────── FastAPI backend ───────────────────────────────┐
 │                                                                                │
 │  1. Vision LLM (OpenRouter)  → reads screenshots into structured JSON          │
 │  2. Rules engine             → deterministic red-flag checks + URL analysis    │
 │  3. Community reports (SQLite) → UPI / phone / handle lookups                  │
 │  4. Score fusion             → one explainable 0-100 score                     │
 │  5. LLM explainer            → plain-language summary from the signals only    │
 │                                                                                │
 └────────────────────────────────────────────────────────────────────────────────┘
```

**Hybrid by design.** The rules engine makes the score explainable and repeatable. The LLM handles what rules cannot, such as reading screenshots, spotting context and writing the explanation. If the LLM is unavailable, the app falls back to rules-only results.

### Scoring

- Each signal adds points by severity: **low 8, medium 18, high 35** (capped at 100)
- Verdict thresholds: **below 25** Low risk, **25-54** Suspicious, **55 and above** High risk
- For messages, the rule score and the LLM's scam-likelihood are blended (60% weight on the higher value, 40% on the lower)
- If any UPI ID, phone or handle has **5 or more** community reports, the score is raised to at least 70

### Safety choices

- Text inside screenshots is treated as **untrusted data** in every prompt, so a scam message cannot instruct the model to rate it as safe
- The explainer may use **only the detected signals**, which limits made-up claims
- Messages are analysed and **not stored**. Only community reports that users choose to submit are saved
- Upload limits: PNG, JPG or WebP, up to 4 images, 5 MB each

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, plain CSS |
| Backend | FastAPI, Pydantic, Uvicorn |
| AI | Vision-capable LLM through OpenRouter (model set in `.env`) |
| Detection | Python rules engine (regex, URL and domain analysis, fuzzy matching) |
| Data | SQLite (community reports) |

## Project structure

```
scamshield/
├── backend/
│   ├── main.py            # FastAPI app and endpoints
│   ├── llm.py             # OpenRouter client, prompts, JSON parsing
│   ├── rules.py           # Rule engine, URL analysis, scoring, entity extraction
│   ├── store.py           # SQLite community report database
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── pages/             # index.js (tabs for each check), _app.js
    ├── components/        # ResultCard.js (shared result view)
    ├── lib/api.js         # API client
    ├── styles/globals.css
    └── package.json
```

---

## Getting started

**Requirements:** Python 3.10+, Node.js 18+, and an [OpenRouter](https://openrouter.ai) API key.

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then edit .env
uvicorn main:app --reload --port 8000
```

In `.env`:

```
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=google/gemini-2.0-flash-001   # any vision-capable model; check openrouter.ai/models
ALLOWED_ORIGINS=http://localhost:3000
```

Check it is running: http://localhost:8000/health (interactive docs at http://localhost:8000/docs).

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000.

---

## Try it

These work without an API key (rules-only mode):

**Email / SMS tab → paste text**
```
URGENT: Your SBI account will be blocked in 24 hours. Update KYC at http://sbi-kyc-update.xyz and share your OTP
```

**Telegram tab**
```
@demo_airdrop_bot Claim your airdrop! Connect wallet now https://bit.ly/x
```

**Instagram tab → "Enter numbers yourself"**
Followers `30K`, average likes `25`, average comments `1`, UPI ID `demo.fakeshop@upi`

Screenshot uploads need the API key.

> The community database ships with **fictional `demo_*` entries** so the report feature can be shown. They are not real accounts.

---

## API reference

| Method | Endpoint | Body |
|---|---|---|
| `GET` | `/health` | none |
| `POST` | `/analyze/screenshot` | multipart: `files` (images), `text` |
| `POST` | `/analyze/instagram` | multipart: `files`, `username`, `upi`, `phone`, `manual_followers`, `manual_avg_likes`, `manual_avg_comments` |
| `POST` | `/analyze/telegram` | JSON: `{ "text": "..." }` |
| `POST` | `/report` | JSON: `{ "entity_type": "upi\|phone\|ig_handle\|tg_handle\|url", "value": "...", "category": "" }` |

All analysis endpoints return the same shape:

```json
{
  "risk_score": 88,
  "verdict": "HIGH_RISK",
  "signals": [
    { "name": "Upfront fee demanded", "severity": "high", "detail": "...", "source": "rule" }
  ],
  "explanation": "Plain-language summary...",
  "recommended_action": "What to do next...",
  "extracted": {},
  "used_ai": true,
  "disclaimer": "These are risk indicators..."
}
```

`source` is `rule`, `ai` or `community`, so the interface can show where each signal came from.

---

## Limitations

Being upfront about what this version does and does not do:

- **Auto-scan is not built.** Gmail and Android SMS scanning appear in the app as a roadmap placeholder only
- **Telegram checks use text only.** It analyses the username and message you paste. It does not look the bot up on Telegram
- **Instagram data comes from your screenshots or numbers.** Instagram has no public profile API, so nothing is scraped
- **Heuristics, not certainty.** Thresholds such as engagement rate are rules of thumb, and genuine small shops can trip some signals
- **Community data is only as good as its reports.** The seeded entries are demo data, and a production version would need moderation to prevent false or malicious reports
- **Results are cached in memory** and reset when the server restarts

## Roadmap

- [ ] Gmail auto-scan with read-only OAuth
- [ ] Android SMS listener (Truecaller-style alerts)
- [ ] Live Telegram bot lookup (creation date, commands, description) via Telethon
- [ ] Reverse image search to catch stolen product photos on fake shops
- [ ] Hindi and Hinglish message support
- [ ] Moderation and abuse protection for community reports
- [ ] Browser extension and share-sheet integration
- [ ] Rate limiting and user accounts

---

## Disclaimer

Scam Shield provides risk indicators based on visible signals. It is not proof of wrongdoing and not legal or financial advice. Always verify through an official channel you look up yourself before sending money or sharing personal details.

## Team

| Name | Role |
|---|---|
| [Honey] | 
| [Siya] |
| [Astha] | [Role] |

## License

[Choose a license, e.g. MIT]


