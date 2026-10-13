"""
Rule engine: deterministic red-flag detection + scoring.

Every detector returns a list of signals:
    {"name": str, "severity": "low|medium|high", "detail": str, "source": "rule|ai|community"}

Scoring is intentionally simple and explainable: each signal adds points based on severity.
"""
import re
from difflib import SequenceMatcher

POINTS = {"low": 8, "medium": 18, "high": 35}


# ---------------------------------------------------------------- helpers
def sig(name, severity, detail, source="rule"):
    return {"name": name, "severity": severity, "detail": detail, "source": source}


def verdict_for(score: int) -> str:
    if score >= 55:
        return "HIGH_RISK"
    if score >= 25:
        return "SUSPICIOUS"
    return "LOW_RISK"


def rule_score(signals) -> int:
    """Points from rule + community signals only (AI signals are fused separately)."""
    total = sum(POINTS[s["severity"]] for s in signals if s["source"] in ("rule", "community"))
    return min(100, total)


def fuse(signals, llm_likelihood=None) -> int:
    base = rule_score(signals)
    if llm_likelihood is None:
        return base
    llm = max(0, min(100, int(llm_likelihood)))
    hi, lo = max(base, llm), min(base, llm)
    return round(0.6 * hi + 0.4 * lo)


def to_number(v):
    """Parse 12, '12.5K', '1,200', '3M' -> float. Returns None if not parseable."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().lower().replace(",", "").replace(" ", "")
    m = re.match(r"^([\d.]+)([kmb]?)$", s)
    if not m:
        return None
    try:
        n = float(m.group(1))
    except ValueError:
        return None
    return n * {"": 1, "k": 1e3, "m": 1e6, "b": 1e9}[m.group(2)]


# ---------------------------------------------------------------- URL tools
URL_RE = re.compile(
    r"(?:https?://|www\.)[^\s<>\"')]+"
    r"|\b(?:bit\.ly|tinyurl\.com|cutt\.ly|rb\.gy|is\.gd|shorturl\.at|ow\.ly|tiny\.cc|t\.ly|s\.id|wa\.me|t\.me)/[^\s]+"
    r"|\b[a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)*\.(?:com|in|net|org|xyz|top|click|icu|tk|ml|ga|cf|gq|buzz|work|info|co\.in|link|live|online|site|shop|store|vip|cc)\b(?:/[^\s]*)?",
    re.I,
)
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "cutt.ly", "rb.gy", "is.gd", "shorturl.at",
              "ow.ly", "tiny.cc", "rebrand.ly", "s.id", "t.ly", "bl.ink", "lnkd.in", "wa.me"}
BAD_TLDS = {"xyz", "top", "click", "icu", "tk", "ml", "ga", "cf", "gq", "buzz", "work", "vip", "cc", "link"}
TWO_LEVEL = {"co.in", "com.au", "co.uk", "org.in", "net.in", "gov.in", "nic.in", "ac.in", "bank.in"}

BRANDS = {
    "paytm": {"paytm.com"}, "phonepe": {"phonepe.com"},
    "sbi": {"sbi.co.in", "onlinesbi.sbi", "sbicard.com", "sbi.bank.in", "onlinesbi.com"},
    "hdfc": {"hdfcbank.com", "hdfc.com", "hdfclife.com"}, "icici": {"icicibank.com", "icicilombard.com"},
    "axis": {"axisbank.com"}, "amazon": {"amazon.in", "amazon.com"}, "flipkart": {"flipkart.com"},
    "netflix": {"netflix.com"}, "paypal": {"paypal.com"}, "google": {"google.com"},
    "microsoft": {"microsoft.com"}, "apple": {"apple.com"}, "instagram": {"instagram.com"},
    "whatsapp": {"whatsapp.com", "wa.me"}, "telegram": {"telegram.org", "t.me"},
    "irctc": {"irctc.co.in"}, "indiapost": {"indiapost.gov.in"}, "incometax": {"incometax.gov.in"},
    "epfo": {"epfindia.gov.in"}, "uidai": {"uidai.gov.in"}, "bluedart": {"bluedart.com"},
    "delhivery": {"delhivery.com"}, "fedex": {"fedex.com"}, "dhl": {"dhl.com"},
}
SHORT_BRANDS = {"sbi", "hdfc", "icici", "axis", "dhl", "epfo"}  # only matched as whole tokens


def registered_domain(host: str) -> str:
    host = host.lower().split(":")[0].strip(".")
    parts = host.split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in TWO_LEVEL:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def extract_urls(text: str):
    seen, out = set(), []
    for m in URL_RE.finditer(text or ""):
        u = m.group(0).rstrip(".,;:!?)")
        if u.lower() not in seen:
            seen.add(u.lower())
            out.append(u)
    return out


def host_of(url: str) -> str:
    u = re.sub(r"^(?:https?://)", "", url, flags=re.I)
    u = u.split("/")[0].split("?")[0]
    return u.split("@")[-1].lower()


def url_signals(urls):
    out = []
    for u in urls:
        host = host_of(u)
        reg = registered_domain(host)
        tld = reg.split(".")[-1]
        flagged_here = False

        if reg in SHORTENERS or host in SHORTENERS:
            out.append(sig("Shortened link", "medium", f"{u} hides its real destination."))
            flagged_here = True
        if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host):
            out.append(sig("Link uses a raw IP address", "high", f"{u} points to an IP, not a real brand domain."))
            flagged_here = True
        if "@" in u.split("?")[0].replace("https://", "").replace("http://", "").split("/")[0] or "xn--" in host:
            out.append(sig("Disguised link", "high", f"{u} uses a deceptive format (@ or punycode)."))
            flagged_here = True
        if tld in BAD_TLDS:
            out.append(sig("Low-trust domain ending", "medium", f".{tld} domains are frequently used for throwaway scam sites ({host})."))
            flagged_here = True

        # Brand lookalike
        tokens = [t for t in re.split(r"[^a-z0-9]+", host) if t]
        flat = "".join(tokens)
        for brand, official in BRANDS.items():
            if reg in official or any(host.endswith("." + o) for o in official):
                continue
            hit = False
            if brand in tokens:
                hit = True
            elif brand not in SHORT_BRANDS and brand in flat:
                hit = True
            else:
                for t in tokens:
                    if brand not in SHORT_BRANDS and len(t) >= 5 and t != brand and SequenceMatcher(None, t, brand).ratio() >= 0.85:
                        hit = True
                        break
            if hit:
                out.append(sig("Look-alike of a known brand", "high",
                               f"{host} imitates '{brand}' but is not an official {brand} domain."))
                flagged_here = True
                break

        if host.count("-") >= 3:
            out.append(sig("Unusually long hyphenated domain", "low", f"{host}"))
        if u.lower().startswith("http://"):
            out.append(sig("Link is not encrypted (http)", "low", f"{u}"))
    return out


# ---------------------------------------------------------------- text signals
def _strip_warnings(text: str) -> str:
    """Remove 'never share your OTP' style warnings so legit bank SMS aren't flagged."""
    return re.sub(r"(?i)\b(do not|don'?t|dont|never|not)\s+(to\s+)?(share|disclose|give|reveal)[^.\n]*", " ", text)


TEXT_RULES = [
    # (name, severity, regex, detail)
    ("Urgency pressure", "medium",
     r"\b(urgent(ly)?|immediately|right away|act now|last chance|final (notice|warning)|expires? (today|soon|in)|"
     r"within \d+ ?(hours?|hrs?|minutes?|mins?)|(account|card|number|sim) (will be |is |has been )?(suspended|blocked|closed|deactivated|disconnected)|"
     r"turant|jaldi|band ho jayega|block ho jayega)\b",
     "Pushes you to act fast so you don't stop and think."),
    ("Asks for OTP / PIN / password", "high",
     r"\b(share|send|enter|provide|confirm|verify|update|submit|reply with|tell us)\b.{0,30}\b(otp|pin|password|cvv|card number|aadhaar|aadhar|pan (card|number)|net ?banking|login details)\b",
     "Legitimate companies never ask for these in a message."),
    ("Asks for secret wallet keys", "high",
     r"\b(seed phrase|recovery phrase|private key|secret phrase|upi pin)\b",
     "Anyone asking for these is trying to empty your account or wallet."),
    ("Upfront fee demanded", "high",
     r"\b(registration|processing|clearance|customs|delivery|handling|advance|security|activation|release) (fee|fees|charge|charges|deposit|payment)\b",
     "Asking you to pay a fee first to receive money, a parcel or a job is a classic scam pattern."),
    ("Prize / refund / reward lure", "medium",
     r"\b(lottery|you (have )?won|lucky (draw|winner)|prize|cashback|reward points|free gift|congratulations|claim your|unclaimed|inaam)\b|\brefund\b",
     "Unexpected winnings or refunds are used as bait."),
    ("KYC / account verification threat", "medium",
     r"\bkyc\b.{0,30}\b(update|expire[sd]?|pending|verification|incomplete|suspend\w*)\b|\b(update|complete|verify)\b.{0,15}\bkyc\b",
     "Banks and wallets don't do KYC through links sent by SMS or email."),
    ("Government / police impersonation", "high",
     r"\b(digital arrest|arrest warrant|cbi officer|narcotics|money laundering case|customs department|trai notice)\b",
     "Scammers impersonate authorities to frighten victims into paying."),
    ("Work-from-home / task earning bait", "medium",
     r"\b(part[- ]?time job|work from home|daily income|earn\s*(rs\.?|₹|inr)?\s*\d[\d,]*\s*(daily|per day|/day|per task)|like (and|&) (earn|subscribe)|prepaid task|youtube task)\b",
     "Fake job and 'task' schemes start with small payouts, then demand deposits."),
    ("Pressure to click a link", "low",
     r"\b(click (here|the link|below)|tap (here|the link)|open (the )?link)\b",
     "Scam messages try to move you quickly to an outside page."),
]


def text_signals(text: str):
    t = _strip_warnings(text or "")
    out = []
    for name, sev, rx, detail in TEXT_RULES:
        m = re.search(rx, t, re.I | re.S)
        if m:
            snippet = re.sub(r"\s+", " ", m.group(0))[:80]
            out.append(sig(name, sev, f"{detail} (matched: \"{snippet}\")"))
    out.extend(url_signals(extract_urls(text or "")))
    return out


# ---------------------------------------------------------------- Telegram
KNOWN_BOTS = ["botfather", "wallet", "combot", "grouphelpbot", "controllerbot", "tonkeeper", "notcoin_bot",
              "hamster_kombat_bot", "trustwallet", "metamask", "binance", "coinbase", "phantom", "tonwallet",
              "raidenbot", "sendpulse", "manybot", "telegram", "durov"]
OFFICIAL_WORDS = r"(support|official|admin|verify|verification|helpdesk|claim|airdrop|giveaway|recovery|service|team)"

TELEGRAM_RULES = [
    ("Airdrop / giveaway bait", "medium",
     r"\b(airdrop|giveaway|free (tokens?|coins?|crypto|usdt|btc)|claim (your )?(reward|tokens?|airdrop)|presale)\b",
     "Free-crypto offers are the most common Telegram bot lure."),
    ("Wallet connect / verification", "high",
     r"\b(connect|verify|validate|sync|link|restore) (your )?(wallet|account)\b|\bwallet (validation|verification|sync|connect)\b",
     "Real services never need you to 'verify' your wallet through a chat bot."),
    ("Send-first, get-more promise", "high",
     r"\b(send|deposit|transfer)\b.{0,40}\b(receive|get|earn|win|return)\b.{0,20}\b(double|2x|3x|5x|10x|\d+ ?x|back)\b",
     "'Send X and get 2X back' is a textbook advance-fee fraud."),
    ("Guaranteed returns", "high",
     r"\b(guaranteed|assured|risk[- ]?free|100% safe) (profit|profits|returns?|income)\b|\bdaily (profit|returns?) of\b",
     "No legitimate investment can guarantee returns."),
    ("Fake admin / support DM", "medium",
     r"\b(admin|support|moderator|team) (will|is going to) (dm|message|contact) you\b|\bdm (me|admin|support)\b.{0,15}\b(to claim|for (help|recovery))\b",
     "Real support doesn't start conversations. Scammers impersonate it."),
]


def telegram_signals(text: str):
    out = []
    raw = text or ""
    handles = set(h.lower() for h in re.findall(r"(?:@|t\.me/)([A-Za-z][A-Za-z0-9_]{3,31})", raw))
    for h in handles:
        base = h[:-3] if h.endswith("bot") else h
        base = base.strip("_")
        for k in KNOWN_BOTS:
            kb = k[:-3].strip("_") if k.endswith("bot") else k
            if h == k:
                continue
            parts = [p for p in re.split(r"_+", base) if len(p) >= 4] or [base]
            close = any(SequenceMatcher(None, p, kb).ratio() >= 0.82 and p != kb for p in parts)
            embedded = kb in base and base != kb and len(kb) >= 5 and re.search(OFFICIAL_WORDS, base)
            if close or embedded:
                out.append(sig("Username imitates a popular bot or brand", "high",
                               f"@{h} closely resembles '{k}'. Typosquatting is how fake bots pass as real ones."))
                break
        else:
            if re.search(OFFICIAL_WORDS, h) and h.endswith("bot"):
                out.append(sig("Official-sounding handle", "low",
                               f"@{h} uses words like support/verify/claim. Real brands rarely do."))
    t = _strip_warnings(raw)
    for name, sev, rx, detail in TELEGRAM_RULES:
        m = re.search(rx, t, re.I | re.S)
        if m:
            snippet = re.sub(r"\s+", " ", m.group(0))[:80]
            out.append(sig(name, sev, f"{detail} (matched: \"{snippet}\")"))
    out.extend(text_signals(raw))
    # de-duplicate by name
    seen, uniq = set(), []
    for s in out:
        if s["name"] not in seen:
            seen.add(s["name"])
            uniq.append(s)
    return uniq


# ---------------------------------------------------------------- Instagram
def instagram_signals(p: dict):
    out = []
    followers = to_number(p.get("followers"))
    following = to_number(p.get("following"))
    posts = to_number(p.get("posts"))
    likes = to_number(p.get("avg_likes"))
    comments = to_number(p.get("avg_comments"))
    age_days = to_number(p.get("account_age_days"))

    if followers and likes is not None:
        er = ((likes or 0) + (comments or 0)) / followers * 100
        p["engagement_rate_pct"] = round(er, 2)
        if followers >= 3000 and er < 0.2:
            out.append(sig("Engagement far below follower count", "high",
                           f"About {er:.2f}% of followers interact per post (healthy accounts are usually 1-5%). Often a sign of bought followers."))
        elif followers >= 1000 and er < 0.7:
            out.append(sig("Low engagement for audience size", "medium",
                           f"About {er:.2f}% of followers interact per post, below the typical 1-5% range."))
    else:
        p["engagement_rate_pct"] = None

    if age_days is not None and age_days <= 30:
        sev = "high" if age_days <= 7 else "medium"
        out.append(sig("Recently created account", sev,
                       f"Account is only {int(age_days)} day{'s' if int(age_days) != 1 else ''} old. Scam accounts are frequently created and discarded."))

    if posts is not None and posts == 0:
        out.append(sig("No posts on profile", "medium",
                       "Profile has 0 posts, which is common on throwaway scam or impersonation accounts."))
    elif followers and posts is not None and followers >= 10000 and posts <= 12:
        out.append(sig("Big audience, very few posts", "medium",
                       f"{int(followers):,} followers but only {int(posts)} posts. Organic shops build up content over time."))

    if following is not None and following > 500 and (followers is None or following > 3 * max(followers, 1)):
        sev = "medium" if (followers is not None and following > 10 * max(followers, 1)) else "low"
        out.append(sig("Follows far more than it is followed", sev,
                       f"Following {int(following):,} accounts with only {int(followers or 0):,} followers is typical of mass-outreach scam accounts."))

    if p.get("has_profile_pic") is False:
        out.append(sig("No profile photo", "low",
                       "Account does not have a profile photo set."))

    # Structured SellerCheck fields
    comments_status = str(p.get("comments_status") or "").lower()
    if any(k in comments_status for k in ("off", "disable", "limited", "closed")):
        out.append(sig("Comments disabled or restricted", "high",
                       "Seller has turned off or limited comments, a common tactic used to prevent scammed buyers from posting warnings."))
    elif any(k in comments_status for k in ("bot", "emoji")):
        out.append(sig("Comments appear bot-driven or generic", "medium",
                       "Comments consist primarily of automated emojis and generic praise rather than genuine customer reviews."))

    age_bucket = str(p.get("account_age_bucket") or "").lower()
    if age_bucket in ("<3m", "< 3 months", "new", "under_3_months") or (age_days is not None and age_days <= 90):
        if not any(s["name"] == "Recently created account" for s in out):
            out.append(sig("Storefront is under 3 months old", "medium",
                           "Account is very new (< 3 months). Most fly-by-night fraudulent sellers operate for only a few weeks before disappearing."))

    pay_type = str(p.get("payment_terms_type") or "").lower()
    if any(k in pay_type for k in ("advance", "upi_only", "no_cod", "prepaid")):
        if not any("Advance" in s["name"] for s in out):
            out.append(sig("Advance / UPI-only payment", "high",
                           "Insists on payment before delivery with no cash-on-delivery, which is the main way fake shops take money."))

    ratio = to_number(p.get("generic_comment_ratio"))
    if ratio is not None and ratio >= 0.6:
        out.append(sig("Comments look generic or automated", "medium",
                       f"Roughly {int(ratio*100)}% of visible comments are emoji-only or copy-paste praise."))

    if p.get("has_website") is False and p.get("has_gst_or_address") is False:
        out.append(sig("No verifiable business details", "medium",
                       "No website, GST number or physical address found in the profile."))

    bio_text = str(p.get("bio_text") or p.get("bio") or "")
    pay = " ".join(str(p.get(k) or "") for k in ("payment_terms",)) + " " + bio_text
    if re.search(r"(?i)\badvance\b|full payment (first|before)|pay (first|before)|prepaid only|no cod|cod not available|only (upi|gpay|phonepe|paytm)", pay):
        out.append(sig("Advance / UPI-only payment", "high",
                       "Insists on payment before delivery with no cash-on-delivery, which is the main way fake shops take money."))
    if re.search(r"(?i)no (return|refund|exchange)s?|all sales final", pay):
        out.append(sig("No returns or refunds", "medium", "Removes your recourse if the product never arrives."))
    if re.search(r"(?i)first copy|master copy|7a quality|replica|\b[5-9]0% ?off\b|wholesale price|lowest price guarantee", pay + " " + str(p.get("price_claims") or "")):
        out.append(sig("Too-good-to-be-true pricing", "medium",
                       "Replica wording or extreme discounts on branded goods."))
    if re.search(r"(?i)only \d+ (left|pieces?)|last (piece|few)|hurry|limited stock", pay + " " + str(p.get("price_claims") or "")):
        out.append(sig("Artificial scarcity", "low", "'Only few left' style pressure to buy quickly."))
    if re.search(r"(?i)\b(guaranteed|assured|risk[- ]?free|100% safe) (profit|profits|returns?|income)\b|\bdaily (profit|returns?|income)\b", bio_text):
        out.append(sig("Guaranteed returns or daily income claim", "high",
                       "Promising guaranteed returns or effortless daily income in a bio is a strong scam indicator."))
    if re.search(r"(?i)\bdm for details\b|\bdm to (earn|join|claim)\b", bio_text):
        out.append(sig("Solicits private DMs for money-making", "low",
                       "Moves targets into private DMs to pitch advance-fee or task scams."))

    for s in text_signals(bio_text):
        if not any(existing["name"] == s["name"] for existing in out):
            out.append(s)

    contacts = [str(c).lower() for c in (p.get("contact_methods") or [])]
    if contacts and all(any(k in c for k in ("whatsapp", "dm", "direct", "wa.me")) for c in contacts) and p.get("has_website") is not True:
        out.append(sig("Contact only via WhatsApp/DM", "low", "No email, website or landline that can be traced."))

    # AI visual observations (capped, never stronger than 'low')
    for v in (p.get("visual_flags") or [])[:2]:
        if isinstance(v, dict) and v.get("name"):
            out.append(sig(str(v["name"])[:80], "low", (str(v.get("detail") or "") + " (AI visual observation, verify manually)")[:240], source="rule"))
    return out


# ---------------------------------------------------------------- entities
UPI_RE = re.compile(r"(?<![\w.])[\w.\-]{2,}@[A-Za-z]{2,15}\b(?!\.[A-Za-z])")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\-\s]?)?([6-9]\d{9})(?!\d)")
HANDLE_RE = re.compile(r"(?<![\w.])@([A-Za-z0-9_.]{3,30})")


def extract_entities(text: str):
    text = text or ""
    emails = sorted(set(m.group(0).lower() for m in EMAIL_RE.finditer(text)))
    email_set = set(emails)
    upis = sorted(set(m.group(0).lower() for m in UPI_RE.finditer(text) if m.group(0).lower() not in email_set))
    return {
        "upi": upis,
        "email": emails,
        "phone": sorted(set(m.group(1) for m in PHONE_RE.finditer(text))),
        "handle": sorted(set(m.group(1).lower() for m in HANDLE_RE.finditer(text))),
    }

