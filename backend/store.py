"""Tiny SQLite store for the community report database (UPI IDs, phones, handles, URLs)."""
import os
import re
import sqlite3
from datetime import datetime, timedelta

DB_PATH = os.getenv("REPORTS_DB", os.path.join(os.path.dirname(__file__), "reports.db"))
VALID_TYPES = {"upi", "phone", "ig_handle", "tg_handle", "url"}


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def normalize(entity_type: str, value: str) -> str:
    v = (value or "").strip().lower()
    if entity_type == "phone":
        digits = re.sub(r"\D", "", v)
        return digits[-10:]
    if entity_type in ("ig_handle", "tg_handle"):
        return v.lstrip("@").strip("/ ")
    if entity_type == "url":
        return re.sub(r"^https?://", "", v).rstrip("/")
    return v


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS reports(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_value TEXT NOT NULL,
            category TEXT,
            created_at TEXT NOT NULL)""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_ent ON reports(entity_type, entity_value)")

        c.execute("""CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            email TEXT,
            name TEXT,
            created_at TEXT NOT NULL)""")

        c.execute("""CREATE TABLE IF NOT EXISTS scan_history(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            scan_type TEXT NOT NULL,
            title TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            verdict TEXT NOT NULL,
            signals_count INTEGER NOT NULL,
            summary TEXT,
            created_at TEXT NOT NULL)""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_hist_user ON scan_history(user_id)")

        n = c.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        if n == 0:
            seed_demo(c)


def seed_demo(c):
    """Clearly fictional demo entries so the community feature can be shown live.
    These are NOT real accounts. Replace with real reports as users submit them."""
    demo = [
        ("upi", "demo.fakeshop@upi", "advance payment, never delivered", 14),
        ("phone", "9999900001", "fake shop owner", 9),
        ("ig_handle", "demo_fake_shop", "fake Instagram store", 11),
        ("tg_handle", "demo_airdrop_bot", "wallet-drainer bot", 7),
        ("upi", "demo.refund@ybl", "refund scam", 2),
    ]
    now = datetime.utcnow()
    for t, v, cat, count in demo:
        for i in range(count):
            c.execute("INSERT INTO reports(entity_type, entity_value, category, created_at) VALUES (?,?,?,?)",
                      (t, v, cat, (now - timedelta(days=i)).isoformat()))


def count_reports(entity_type: str, value: str) -> int:
    v = normalize(entity_type, value)
    if not v:
        return 0
    with _conn() as c:
        return c.execute("SELECT COUNT(*) FROM reports WHERE entity_type=? AND entity_value=?",
                         (entity_type, v)).fetchone()[0]


def add_report(entity_type: str, value: str, category: str = "") -> int:
    if entity_type not in VALID_TYPES:
        raise ValueError("Unknown entity type")
    v = normalize(entity_type, value)
    if not v or len(v) > 200:
        raise ValueError("Invalid value")
    with _conn() as c:
        c.execute("INSERT INTO reports(entity_type, entity_value, category, created_at) VALUES (?,?,?,?)",
                  (entity_type, v, (category or "")[:120], datetime.utcnow().isoformat()))
    return count_reports(entity_type, v)


def save_history(user_id: str, scan_type: str, title: str, risk_score: int, verdict: str, signals_count: int, summary: str = "") -> int:
    with _conn() as c:
        cur = c.execute(
            """INSERT INTO scan_history(user_id, scan_type, title, risk_score, verdict, signals_count, summary, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (user_id, scan_type, title[:100], risk_score, verdict, signals_count, summary[:300], datetime.utcnow().isoformat())
        )
        return cur.lastrowid


def get_history(user_id: str, limit: int = 30):
    with _conn() as c:
        rows = c.execute(
            """SELECT id, user_id, scan_type, title, risk_score, verdict, signals_count, summary, created_at
               FROM scan_history WHERE user_id=? ORDER BY id DESC LIMIT ?""",
            (user_id, limit)
        ).fetchall()
        return [dict(r) for r in rows]

