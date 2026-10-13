# Scam Shield

Checks emails/SMS (screenshot or pasted text), Instagram shops and Telegram bots for scam risk indicators.

## Run it (about 5 minutes)

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # add your OPENROUTER_API_KEY
uvicorn main:app --reload --port 8000
```
Check http://localhost:8000/health and http://localhost:8000/docs

**Frontend**
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## How it works
- `rules.py`: deterministic red-flag checks (urgency, OTP requests, fees, shortened and look-alike links, Instagram engagement and payment signals, Telegram typosquatting). Each signal adds points by severity.
- `llm.py`: OpenRouter vision model reads screenshots into structured JSON and writes the plain-language explanation. If the model is down, the app falls back to rules-only and template text.
- `store.py`: SQLite community reports (UPI IDs, phones, handles). **Seeded with clearly fictional `demo_*` entries** so you can show the feature. Try UPI `demo.fakeshop@upi` or handle `demo_fake_shop`.
- Score fusion: for messages, rule score and AI likelihood are blended; entities reported 5+ times force a high-risk floor.

## Demo-safe inputs (no API key needed)
- Telegram tab: `@demo_airdrop_bot Claim your airdrop! Connect wallet now https://bit.ly/x`
- Message tab (paste text): `URGENT: Your SBI account will be blocked in 24 hours. Update KYC at http://sbi-kyc-update.xyz and share your OTP`
- Instagram tab, manual numbers: followers 30K, likes 25, comments 1, UPI `demo.fakeshop@upi`


