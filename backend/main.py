"""
Scam Shield API
Run:  uvicorn main:app --reload --port 8000
"""
import hashlib
import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import llm  # noqa: E402
import rules  # noqa: E402
import store  # noqa: E402

app = FastAPI(title="Scam Shield API", version="0.1.0")

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_env.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGES = 4
ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp"}
DISCLAIMER = ("These are risk indicators based on visible signals, not proof of wrongdoing. "
              "Verify independently before sending money or sharing details.")

_cache = {}  # sha256 -> result (keeps repeat demos fast and cheap)


@app.on_event("startup")
def _startup():
    store.init_db()


from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile

WEIGHT_MAP = {"high": 0.9, "medium": 0.55, "low": 0.25}
LABEL_MAP = {"LOW_RISK": "safe", "SUSPICIOUS": "suspicious", "HIGH_RISK": "scam"}


class Signal(BaseModel):
    name: str
    severity: str
    detail: str
    source: str = "rule"
    weight: float = 0.5


class AnalysisResult(BaseModel):
    risk_score: int
    score: int = 0
    verdict: str
    label: str = "safe"
    signals: List[Signal]
    explanation: str
    recommended_action: str
    summary_hi: Optional[str] = ""
    action_steps_hi: Optional[str] = ""
    extracted: dict = {}
    entities: dict = {}
    rule_score: float = 0.0
    ml_probability: Optional[float] = None
    blacklist_hits: List[str] = []
    used_ai: bool = False
    disclaimer: str = DISCLAIMER


# ------------------------------------------------------------------ helpers
async def read_images(files: List[UploadFile]):
    out = []
    for f in (files or [])[:MAX_IMAGES]:
        if not f or not f.filename:
            continue
        if f.content_type not in ALLOWED_MIME:
            raise HTTPException(400, f"{f.filename}: only PNG, JPG or WebP images are supported.")
        data = await f.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(400, f"{f.filename}: image is larger than 5 MB.")
        if data:
            out.append((data, f.content_type))
    return out


def digest(kind: str, images, text: str = "") -> str:
    h = hashlib.sha256(kind.encode())
    for d, _ in images:
        h.update(hashlib.sha256(d).digest())
    h.update(text.encode())
    return h.hexdigest()


def community_signals(entities: dict, extra: Optional[dict] = None):
    """Look up UPI IDs, phones and handles in the community report DB."""
    checks = [("upi", v) for v in entities.get("upi", [])] + [("phone", v) for v in entities.get("phone", [])]
    checks += [("ig_handle", v) for v in entities.get("ig_handle", [])]
    checks += [("tg_handle", v) for v in entities.get("tg_handle", [])]
    for t, vals in (extra or {}).items():
        checks += [(t, v) for v in vals if v]
    out, worst = [], 0
    seen = set()
    for t, v in checks:
        key = (t, store.normalize(t, v))
        if key in seen or not key[1]:
            continue
        seen.add(key)
        n = store.count_reports(t, v)
        if n:
            worst = max(worst, n)
            label = {"upi": "UPI ID", "phone": "Phone number", "ig_handle": "Instagram handle",
                     "tg_handle": "Telegram handle", "url": "Link"}[t]
            out.append(rules.sig(f"{label} reported by other users", "high" if n >= 3 else "medium",
                                 f"{v} has been reported {n} time{'s' if n != 1 else ''} in the community database.",
                                 source="community"))
    return out, worst


def fallback_text(verdict: str, signals):
    top = [s["name"].lower() for s in signals[:3]]
    if verdict == "HIGH_RISK":
        exp = "Several strong risk indicators were found" + (f", including {', '.join(top)}." if top else ".")
        act = "Do not click links, pay, or share any codes or details. Block the sender and report it."
        exp_hi = "संदेश में कई गंभीर खतरे के संकेत मिले हैं। किसी भी लिंक या अनुरोध पर भरोसा न करें।"
        act_hi = "किसी भी लिंक पर क्लिक न करें, पैसे न भेजें और ओटीपी या पिन साझा न करें। प्रेषक को तुरंत ब्लॉक करें।"
    elif verdict == "SUSPICIOUS":
        exp = "Some risk indicators were found" + (f": {', '.join(top)}." if top else ".")
        act = "Verify through an official channel you look up yourself before taking any action."
        exp_hi = "इस संदेश में कुछ संदिग्ध संकेत पाए गए हैं। आगे बढ़ने से पहले सावधानी बरतें।"
        act_hi = "कोई भी कदम उठाने से पहले स्वतंत्र और आधिकारिक माध्यम से पूरी जांच करें।"
    else:
        exp = "No strong risk indicators were detected in what could be analysed."
        act = "Stay cautious: never share OTPs or pay in advance to someone you cannot verify."
        exp_hi = "विश्लेषण में कोई स्पष्ट या गंभीर खतरा नहीं पाया गया।"
        act_hi = "हमेशा सतर्क रहें: कभी भी ओटीपी साझा न करें और अज्ञात व्यक्तियों को अग्रिम भुगतान न करें।"
    return exp, act, exp_hi, act_hi


def format_entities(raw_text: str = "", extra_entities: Optional[dict] = None) -> dict:
    ent = rules.extract_entities(raw_text or "")
    urls = rules.extract_urls(raw_text or "")
    if extra_entities:
        for k, vals in extra_entities.items():
            if vals:
                ent[k] = sorted(set((ent.get(k) or []) + [v for v in vals if v]))
    return {
        "urls": urls,
        "phones": ent.get("phone", []),
        "upi_ids": ent.get("upi", []),
        "emails": ent.get("email", []),
        "handles": ent.get("handle", []),
    }


async def finish(kind, signals, llm_likelihood, extracted, used_ai, floor_from_reports=0, entities_map=None):
    r_score = rules.rule_score(signals)
    score = rules.fuse(signals, llm_likelihood)
    if floor_from_reports >= 5:
        score = max(score, 70)
    verdict = rules.verdict_for(score)
    signals = sorted(signals, key=lambda s: {"high": 0, "medium": 1, "low": 2}[s["severity"]])
    enriched_signals = [
        {**s, "weight": s.get("weight", WEIGHT_MAP.get(s["severity"], 0.5))}
        for s in signals
    ]
    fb_exp, fb_act, fb_hi, fb_act_hi = fallback_text(verdict, enriched_signals)
    summary_hi, action_steps_hi = fb_hi, fb_act_hi
    try:
        explanation, action, s_hi, a_hi = await llm.explain(kind, score, verdict, enriched_signals)
        used_ai = True
        if not explanation:
            raise llm.LLMUnavailable("empty")
        if s_hi:
            summary_hi = s_hi
        if a_hi:
            action_steps_hi = a_hi
    except llm.LLMUnavailable:
        explanation, action = fb_exp, fb_act
    rec_action = action or fb_act
    comm_hits = [s["detail"] for s in enriched_signals if s.get("source") == "community"]
    return AnalysisResult(
        risk_score=score,
        score=score,
        verdict=verdict,
        label=LABEL_MAP.get(verdict, "safe"),
        signals=enriched_signals,
        explanation=explanation,
        recommended_action=rec_action,
        summary_hi=summary_hi,
        action_steps_hi=action_steps_hi,
        extracted=extracted,
        entities=entities_map or {"urls": [], "phones": [], "upi_ids": [], "emails": [], "handles": []},
        rule_score=round(r_score / 100.0, 2),
        ml_probability=round(float(llm_likelihood) / 100.0, 2) if llm_likelihood is not None else None,
        blacklist_hits=comm_hits,
        used_ai=used_ai,
    )


# ------------------------------------------------------------------ endpoints
@app.get("/health")
def health():
    return {"ok": True, "ai_configured": bool(os.getenv("OPENROUTER_API_KEY"))}


class TextIn(BaseModel):
    text: str


@app.post("/analyze/text", response_model=AnalysisResult)
async def analyze_text(body: TextIn):
    """Analyze pasted SMS, WhatsApp, Telegram or DM text."""
    return await _run_message_analysis([], body.text)


class EmailIn(BaseModel):
    subject: str = ""
    body: str = ""
    sender: str = ""


@app.post("/analyze/email", response_model=AnalysisResult)
async def analyze_email(payload: EmailIn):
    """Analyze email sender, subject, and body."""
    parts = []
    if payload.sender.strip():
        parts.append(f"From: {payload.sender.strip()}")
    if payload.subject.strip():
        parts.append(f"Subject: {payload.subject.strip()}")
    if payload.body.strip():
        parts.append(payload.body.strip())
    combined = "\n".join(parts)
    if not combined.strip():
        raise HTTPException(400, "Paste the email body first.")

    extra_sigs = []
    sender_str = payload.sender.strip().lower()
    if "@" in sender_str:
        sender_domain = sender_str.split("@")[-1].strip("> ")
        reg_dom = rules.registered_domain(sender_domain)
        free_mail = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com", "proton.me", "icloud.com"}
        body_lower = (payload.subject + " " + payload.body).lower()
        for brand, official_domains in rules.BRANDS.items():
            if brand in body_lower and reg_dom not in official_domains:
                if reg_dom in free_mail:
                    extra_sigs.append(rules.sig(
                        "Brand email sent from a personal address", "high",
                        f"Mentions '{brand.upper()}' but was sent from a free email provider ({sender_domain})."
                    ))
                    break
                else:
                    extra_sigs.append(rules.sig(
                        "Sender domain does not match brand", "medium",
                        f"Email references '{brand.upper()}' but comes from {sender_domain}."
                    ))
                    break

    return await _run_message_analysis([], combined, extra_signals=extra_sigs)


async def _run_message_analysis(images, text: str, extra_signals=None):
    text = (text or "")[:6000]
    if not images and not text.strip():
        raise HTTPException(400, "Upload a screenshot or paste the message text.")

    key = digest("screenshot", images, text)
    if key in _cache:
        return _cache[key]

    ai, llm_likelihood, used_ai = {}, None, False
    if images:
        try:
            ai = await llm.extract_message(images, text)
            used_ai = True
            llm_likelihood = ai.get("scam_likelihood")
        except llm.LLMUnavailable as e:
            if not text.strip():
                raise HTTPException(503, f"AI screenshot reader is unavailable ({e}). Paste the message text instead.")

    full_text = "\n".join(t for t in [str(ai.get("extracted_text") or ""), text, str(ai.get("sender") or "")] if t)
    signals = list(extra_signals or []) + rules.text_signals(full_text)

    for s in (ai.get("signals") or [])[:6]:
        if isinstance(s, dict) and s.get("name") and s.get("severity") in ("low", "medium", "high"):
            if not any(s["name"].lower() == r["name"].lower() for r in signals):
                signals.append(rules.sig(str(s["name"])[:80], s["severity"], str(s.get("detail", ""))[:240], source="ai"))

    entities = rules.extract_entities(full_text)
    comm, worst = community_signals(entities)
    signals += comm

    extracted = {
        "channel": ai.get("channel"), "sender": ai.get("sender"),
        "impersonated_brand": ai.get("impersonated_brand"),
        "urls": rules.extract_urls(full_text), "entities": {k: v for k, v in entities.items() if k != "handle"},
        "text_preview": (ai.get("extracted_text") or text)[:500],
    }
    entities_map = format_entities(full_text)
    result = await finish("email_or_sms", signals, llm_likelihood, extracted, used_ai, worst, entities_map)
    _cache[key] = result
    return result


@app.post("/analyze/screenshot", response_model=AnalysisResult)
async def analyze_screenshot(
    files: List[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(default=None),
    text: str = Form(""),
):
    """Email / SMS / chat screenshot and/or pasted text."""
    all_files = list(files or [])
    if file is not None:
        all_files.append(file)
    images = await read_images(all_files)
    return await _run_message_analysis(images, text)


@app.post("/analyze/instagram", response_model=AnalysisResult)
async def analyze_instagram(request: Request):
    """Fake-shop / profile risk check from JSON profile object OR multipart form with screenshots/numbers."""
    content_type = request.headers.get("content-type", "")
    images = []
    username = upi = phone = bio = ""
    manual_followers = manual_following = manual_posts = manual_age = ""
    manual_avg_likes = manual_avg_comments = ""
    has_profile_pic = None

    if "application/json" in content_type:
        body = await request.json()
        p_in = body.get("profile") if isinstance(body.get("profile"), dict) else body
        username = str(p_in.get("username") or "")
        bio = str(p_in.get("bio") or p_in.get("bio_text") or "")
        upi = str(p_in.get("upi") or "")
        phone = str(p_in.get("phone") or "")
        if p_in.get("followers") is not None:
            manual_followers = str(p_in.get("followers"))
        if p_in.get("following") is not None:
            manual_following = str(p_in.get("following"))
        if p_in.get("posts") is not None:
            manual_posts = str(p_in.get("posts"))
        if p_in.get("account_age_days") is not None:
            manual_age = str(p_in.get("account_age_days"))
        if p_in.get("avg_likes") is not None:
            manual_avg_likes = str(p_in.get("avg_likes"))
        if p_in.get("avg_comments") is not None:
            manual_avg_comments = str(p_in.get("avg_comments"))
        if "has_profile_pic" in p_in:
            has_profile_pic = bool(p_in.get("has_profile_pic"))
        if p_in.get("comments_status") is not None:
            comments_status_val = str(p_in.get("comments_status"))
        else:
            comments_status_val = ""
        if p_in.get("account_age_bucket") is not None:
            age_bucket_val = str(p_in.get("account_age_bucket"))
        else:
            age_bucket_val = ""
        if p_in.get("payment_terms_type") is not None:
            pay_terms_val = str(p_in.get("payment_terms_type"))
        else:
            pay_terms_val = ""
    else:
        form = await request.form()
        raw_files = form.getlist("files") + form.getlist("file")
        upload_files = [f for f in raw_files if hasattr(f, "filename")]
        images = await read_images(upload_files)
        username = str(form.get("username") or "")
        upi = str(form.get("upi") or "")
        phone = str(form.get("phone") or "")
        bio = str(form.get("bio") or "")
        manual_followers = str(form.get("manual_followers") or form.get("followers") or "")
        manual_following = str(form.get("manual_following") or form.get("following") or "")
        manual_posts = str(form.get("manual_posts") or form.get("posts") or "")
        manual_age = str(form.get("account_age_days") or form.get("age") or "")
        manual_avg_likes = str(form.get("manual_avg_likes") or form.get("avg_likes") or "")
        manual_avg_comments = str(form.get("manual_avg_comments") or form.get("avg_comments") or "")
        if "has_profile_pic" in form:
            has_profile_pic = str(form.get("has_profile_pic")).lower() not in ("false", "0", "no")
        comments_status_val = str(form.get("comments_status") or "")
        age_bucket_val = str(form.get("account_age_bucket") or "")
        pay_terms_val = str(form.get("payment_terms_type") or "")

    manual = any(x.strip() for x in [manual_followers, manual_following, manual_posts, manual_age, manual_avg_likes, bio, comments_status_val, age_bucket_val, pay_terms_val])
    if not images and not manual and not any(x.strip() for x in [username, upi, phone]):
        raise HTTPException(400, "Add profile details, a username, a UPI ID/phone, or upload screenshots.")

    key = digest("ig", images, "|".join([username, upi, phone, bio, manual_followers, manual_following, manual_posts, manual_age, manual_avg_likes, manual_avg_comments, str(has_profile_pic), comments_status_val, age_bucket_val, pay_terms_val]))
    if key in _cache:
        return _cache[key]

    profile, used_ai = {}, False
    if images:
        try:
            profile = await llm.extract_instagram(images)
            used_ai = True
        except llm.LLMUnavailable as e:
            if not manual and not any(x.strip() for x in [username, upi, phone]):
                raise HTTPException(503, f"AI screenshot reader is unavailable ({e}). Enter the profile details manually.")

    if manual_followers.strip():
        profile["followers"] = manual_followers
    if manual_following.strip():
        profile["following"] = manual_following
    if manual_posts.strip():
        profile["posts"] = manual_posts
    if manual_age.strip():
        profile["account_age_days"] = manual_age
    if manual_avg_likes.strip():
        profile["avg_likes"] = manual_avg_likes
    if manual_avg_comments.strip():
        profile["avg_comments"] = manual_avg_comments
    if bio.strip():
        profile["bio_text"] = bio.strip()
    if has_profile_pic is not None:
        profile["has_profile_pic"] = has_profile_pic
    if comments_status_val.strip():
        profile["comments_status"] = comments_status_val.strip()
    if age_bucket_val.strip():
        profile["account_age_bucket"] = age_bucket_val.strip()
    if pay_terms_val.strip():
        profile["payment_terms_type"] = pay_terms_val.strip()
    handle = (username or profile.get("username") or "").strip().lstrip("@")
    if handle:
        profile["username"] = handle

    signals = rules.instagram_signals(profile)

    text_blob = " ".join(str(profile.get(k) or "") for k in ("bio_text", "payment_terms", "payment_terms_type")) + f" {upi} {phone}"
    entities = rules.extract_entities(text_blob)
    extra = {"upi": [upi.strip()] if upi.strip() else [], "phone": [phone.strip()] if phone.strip() else [],
             "ig_handle": [handle] if handle else []}
    comm, worst = community_signals(entities, extra)
    signals += comm

    shown = {k: profile.get(k) for k in ("username", "followers", "following", "posts", "account_age_days",
                                          "avg_likes", "avg_comments", "engagement_rate_pct", "bio_text",
                                          "contact_methods", "payment_terms", "comment_samples",
                                          "comments_status", "account_age_bucket", "payment_terms_type") if profile.get(k) not in (None, "", [])}
    entities_map = format_entities(text_blob, {"upi": extra["upi"], "phone": extra["phone"], "handle": extra["ig_handle"]})
    result = await finish("instagram_shop", signals, None, shown, used_ai, worst, entities_map)
    _cache[key] = result
    return result



class TelegramIn(BaseModel):
    text: str


@app.post("/analyze/telegram", response_model=AnalysisResult)
async def analyze_telegram(body: TelegramIn):
    """Bot username (@name or t.me link) and/or the message the bot sent."""
    text = (body.text or "").strip()[:6000]
    if not text:
        raise HTTPException(400, "Paste a bot username or message.")
    key = digest("tg", [], text)
    if key in _cache:
        return _cache[key]
    signals = rules.telegram_signals(text)
    entities = rules.extract_entities(text)
    extra = {"tg_handle": entities.get("handle", [])}
    comm, worst = community_signals({k: entities[k] for k in ("upi", "phone")}, extra)
    signals += comm
    handles = entities.get("handle", [])
    entities_map = format_entities(text)
    result = await finish("telegram_bot", signals, None,
                          {"handles": handles, "urls": rules.extract_urls(text)}, False, worst, entities_map)
    _cache[key] = result
    return result


class ReportIn(BaseModel):
    entity_type: str
    value: str
    category: str = ""


@app.post("/report")
def report(body: ReportIn):
    try:
        n = store.add_report(body.entity_type, body.value, body.category)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "total_reports": n}


class HistoryIn(BaseModel):
    user_id: str
    scan_type: str
    title: str
    risk_score: int
    verdict: str
    signals_count: int
    summary: str = ""


@app.post("/history")
def add_history(body: HistoryIn):
    hist_id = store.save_history(body.user_id, body.scan_type, body.title, body.risk_score, body.verdict, body.signals_count, body.summary)
    return {"ok": True, "id": hist_id}


@app.get("/history/{user_id}")
def list_history(user_id: str, limit: int = 30):
    return {"history": store.get_history(user_id, limit)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)


