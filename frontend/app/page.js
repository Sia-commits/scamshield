"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const TEXT = { safe: "Looks safe", suspicious: "Be careful", scam: "Likely a scam" };
const COLOR = { safe: "var(--safe)", suspicious: "var(--warn)", scam: "var(--bad)" };
const ENT = { urls: "Links", phones: "Phones", upi_ids: "UPI IDs", emails: "Emails", handles: "Handles" };
const SOURCE_LABEL = { rule: "Rule check", ai: "AI reading", community: "Community report" };
const TABS = [
  ["text", "Message"],
  ["shot", "Screenshot"],
  ["insta", "Instagram profile"],
  ["telegram", "Telegram bot"],
  ["mail", "Email"],
];

const EX_SCAM = "Dear customer, your SBI account will be blocked today. Update KYC immediately at http://sbi-kyc-update.xyz or call 9876543210. Share the OTP to avoid penalty.";
const EX_SAFE = "Hey, are we still on for lunch tomorrow at 1? I will send you the lecture notes tonight.";
const EX_IG = { user: "earn_daily_77", age: "6", bio: "Work from home. Earn daily income, guaranteed returns. DM for details", fol: "12", ing: "4300", posts: "0", likes: "", comments: "", upi: "demo.fakeshop@upi", phone: "", pic: false };
const EX_IG_SHOP = { user: "demo_fake_shop", age: "14", bio: "7A master copy shoes at 80% off! Prepaid only via UPI. No COD, no returns.", fol: "30000", ing: "120", posts: "8", likes: "25", comments: "1", upi: "demo.fakeshop@upi", phone: "", pic: true };
const EX_TG = "@demo_airdrop_bot Claim your free USDT airdrop! Connect your wallet now at https://bit.ly/x or send 100 USDT to receive 2x back.";
const EX_MAIL = {
  from: "sbi.kyc.alert@gmail.com",
  sub: "URGENT: Your SBI Account Will Be Suspended in 24 Hours",
  body: "Dear Customer, your SBI netbanking KYC has expired. Click here immediately to verify your PAN and OTP at http://sbi-kyc-update.xyz to avoid account suspension.",
};

async function post(path, body, isForm) {
  let res;
  try {
    res = await fetch("/api/analyze/" + path, {
      method: "POST",
      headers: isForm ? {} : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the website's own server. Is `npm run dev` still running?");
  }
  if (res.status >= 500) {
    let detail = "";
    try {
      const j = await res.json();
      if (j.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(detail || "Cannot reach the analysis server. Make sure Uvicorn is running.");
  }
  if (!res.ok) {
    let detail = `The server rejected the request (${res.status}). Check the fields and try again.`;
    try {
      const j = await res.json();
      if (j.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

function highlight(text, vals) {
  if (!vals.length) return text;
  const rx = new RegExp("(" + vals.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");
  return text.split(rx).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

function Result({ r, shown }) {
  const score = r.score ?? r.risk_score ?? 0;
  const label = r.label || (r.verdict === "HIGH_RISK" ? "scam" : r.verdict === "SUSPICIOUS" ? "suspicious" : "safe");
  const entities = r.entities || { urls: [], phones: [], upi_ids: [], emails: [], handles: [] };

  const [on, setOn] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const f = requestAnimationFrame(() => setOn(true));
    const t0 = performance.now();
    let id;
    const tick = (t) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / 900);
      setN(Math.round(score * p));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(f);
      cancelAnimationFrame(id);
    };
  }, [score]);

  const flags = [...(r.signals || [])].sort((a, b) => (b.weight ?? 0.5) - (a.weight ?? 0.5));
  const found = Object.keys(ENT).filter((k) => (entities[k] || []).length);
  const vals = found.flatMap((k) => entities[k]).sort((a, b) => b.length - a.length);
  const previewText = shown || r.extracted?.text_preview || "";

  return (
    <>
      <div className="score">
        <p className="verdict" style={{ color: COLOR[label] }}>{TEXT[label]}</p>
        <small>risk <b>{n}</b> / 100</small>
      </div>
      <div className="meter"><i /><i /><i /><div className="pin" style={{ left: on ? `calc(${score}% - 2px)` : 0 }} /></div>
      <div className="scale"><span>Safe</span><span>Suspicious</span><span>Scam</span></div>
      <p className="why">{r.explanation}</p>
      {r.recommended_action && (
        <div className="action-box">
          <b>Recommended action</b>
          <span>{r.recommended_action}</span>
        </div>
      )}
      <h3>{flags.length ? "Red flags found" : "No red flags found"}</h3>
      {flags.map((s, idx) => (
        <div className="flag" key={s.name + idx}>
          <div className="flag-head">
            <b>{s.name.replace(/_/g, " ")}</b>
            {s.source && <span className="flag-tag">{SOURCE_LABEL[s.source] || s.source}</span>}
          </div>
          <p>{s.detail}</p>
          <div className="bar" title="Strength"><i style={{ width: Math.round((s.weight ?? 0.5) * 100) + "%" }} /></div>
        </div>
      ))}
      {found.length > 0 && <h3>Pulled from the content</h3>}
      {found.map((k) => (
        <div className="chips" key={k}><span>{ENT[k]}</span>{entities[k].map((v) => <code key={v}>{v}</code>)}</div>
      ))}
      {previewText && (<><h3>What we looked at</h3><div className="ev">{highlight(previewText, vals)}</div></>)}
      <div className="stats">
        <span>Rules: {Math.round((r.rule_score ?? score / 100) * 100)}%</span>
        <span>Wording / AI model: {r.ml_probability != null ? Math.round(r.ml_probability * 100) + "%" : (r.used_ai ? "active" : "rules + community")}</span>
        {(r.blacklist_hits || []).length > 0 && <span style={{ color: "var(--bad)", fontWeight: 600 }}>Reported scam match</span>}
      </div>
    </>
  );
}

function Silhouette() {
  const edge = { stroke: "#4ade6b", strokeWidth: 2.5, strokeLinejoin: "round" };
  return (
    <svg className="sil" viewBox="0 0 400 440" aria-hidden="true">
      <defs><filter id="glow"><feGaussianBlur stdDeviation="7" /></filter></defs>
      <path d="M10 440C30 360 110 320 200 316c90 4 170 44 190 124z" fill="#0a0f0c" {...edge} />
      <ellipse cx="200" cy="232" rx="80" ry="100" fill="#050706" />
      <path d="M176 302q24 10 48 0" fill="none" stroke="#2a3a2e" strokeWidth="3" strokeLinecap="round" />
      <path d="M108 176C110 92 150 40 200 40s90 52 92 136z" fill="#0b110d" {...edge} />
      <path d="M44 192C84 138 316 138 356 192C318 222 82 222 44 192z" fill="#0b110d" {...edge} />
      <g className="eye"><circle cx="238" cy="232" r="13" fill="#4ade6b" filter="url(#glow)" /><circle cx="238" cy="232" r="6" fill="#b6ffc8" /></g>
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [shotText, setShotText] = useState("");
  const [over, setOver] = useState(false);
  const [ig, setIg] = useState({ user: "", age: "", bio: "", fol: "", ing: "", posts: "", likes: "", comments: "", upi: "", phone: "", pic: true });
  const [tg, setTg] = useState("");
  const [mail, setMail] = useState({ from: "", sub: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  const [repType, setRepType] = useState("upi");
  const [repVal, setRepVal] = useState("");
  const [repMsg, setRepMsg] = useState("");

  const fileRef = useRef(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const setI = (k) => (e) => setIg({ ...ig, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setM = (k) => (e) => setMail({ ...mail, [k]: e.target.value });
  const pick = (f) => f && f.type.startsWith("image/") && setFile(f);

  async function run() {
    setErr("");
    let call, shown = "";
    if (tab === "text") {
      shown = text.trim();
      if (!shown) return setErr("Paste a message first.");
      call = () => post("text", { text: shown });
    } else if (tab === "shot") {
      if (!file && !shotText.trim()) return setErr("Choose a screenshot first.");
      const fd = new FormData();
      if (file) fd.append("files", file);
      if (shotText.trim()) fd.append("text", shotText.trim());
      shown = shotText.trim();
      call = () => post("screenshot", fd, true);
    } else if (tab === "insta") {
      const n = (v) => (v === "" ? undefined : Number(v));
      const profile = {
        username: ig.user.trim() || undefined,
        bio: ig.bio,
        followers: n(ig.fol),
        following: n(ig.ing),
        posts: n(ig.posts),
        avg_likes: n(ig.likes),
        avg_comments: n(ig.comments),
        account_age_days: n(ig.age),
        upi: ig.upi.trim() || undefined,
        phone: ig.phone.trim() || undefined,
        has_profile_pic: ig.pic,
      };
      shown = [ig.user ? `@${ig.user.replace(/^@/, "")}` : "", ig.bio, ig.upi, ig.phone].filter(Boolean).join(" — ");
      call = () => post("instagram", { profile });
    } else if (tab === "telegram") {
      shown = tg.trim();
      if (!shown) return setErr("Paste a Telegram bot username, link or message first.");
      call = () => post("telegram", { text: shown });
    } else {
      shown = mail.body.trim();
      if (!shown) return setErr("Paste the email body first.");
      call = () => post("email", { subject: mail.sub, body: shown, sender: mail.from.trim() });
    }
    setBusy(true);
    setRes(null);
    try {
      setRes({ report: await call(), shown, id: Date.now() });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!repVal.trim()) return;
    setRepMsg("");
    try {
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: repType, value: repVal.trim(), category: "" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Failed to submit report");
      setRepMsg(`Reported! This now has ${j.total_reports} community report${j.total_reports !== 1 ? "s" : ""}.`);
      setRepVal("");
    } catch (e) {
      setRepMsg(e.message || "Could not submit report.");
    }
  }

  return (
    <div className="shell">
      <section className="hero">
        <div className="nav">
          <div className="logo">Scam<br />Check</div>
          <nav className="pill"><a className="on" href="#check">Check</a><a href="#how">How it works</a></nav>
        </div>
        <Silhouette />
        <div className="hero-copy">
          <h1>We <span className="hl a">spot</span> scams<br />before <span className="hl b">you</span> click<span className="red">!</span></h1>
          <p>Paste a message, upload a screenshot or check a profile. Scam Check finds the red flags and explains them in plain words before you reply or pay.</p>
          <div className="ctas"><a className="btn-g" href="#check">Check a message</a><a className="btn-t" href="#how">See how it works</a></div>
        </div>
      </section>

      <div className="wrap" id="check">
        <main className="grid">
          <section className="in">
            <div className="tabs" role="tablist">
              {TABS.map(([k, name]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{name}</button>
              ))}
            </div>

            {tab === "text" && (
              <div>
                <label htmlFor="t-text">Message text</label>
                <textarea id="t-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an SMS, WhatsApp, Telegram or DM here" />
                <div className="hint">
                  <button type="button" onClick={() => setText(EX_SCAM)}>Fill a scam example</button>
                  <button type="button" onClick={() => setText(EX_SAFE)}>Fill a normal message</button>
                </div>
              </div>
            )}

            {tab === "shot" && (
              <div>
                <label>Screenshot of the message or profile</label>
                <div
                  className={"drop" + (over ? " over" : "")} tabIndex={0} role="button" aria-label="Choose a screenshot"
                  onClick={() => fileRef.current.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current.click())}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
                >
                  {preview && <img src={preview} alt="Selected screenshot" />}
                  <div>{file ? file.name : "Drop an image here or click to choose one"}</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
                <label htmlFor="s-text">Optional text or context</label>
                <textarea id="s-text" style={{ minHeight: 80 }} value={shotText} onChange={(e) => setShotText(e.target.value)} placeholder="Add any text from the message if you'd like" />
                <div className="hint">Reading images can take a while the first time.</div>
              </div>
            )}

            {tab === "insta" && (
              <div>
                <div className="row">
                  <div><label htmlFor="i-user">Username</label><input type="text" id="i-user" value={ig.user} onChange={setI("user")} placeholder="earn_daily_77" /></div>
                  <div><label htmlFor="i-age">Account age (days)</label><input type="number" min="0" id="i-age" value={ig.age} onChange={setI("age")} /></div>
                </div>
                <label htmlFor="i-bio">Bio</label>
                <textarea id="i-bio" style={{ minHeight: 90 }} value={ig.bio} onChange={setI("bio")} placeholder="Paste the profile bio" />
                <div className="row" style={{ marginTop: 14 }}>
                  <div><label htmlFor="i-fol">Followers</label><input type="number" min="0" id="i-fol" value={ig.fol} onChange={setI("fol")} /></div>
                  <div><label htmlFor="i-ing">Following</label><input type="number" min="0" id="i-ing" value={ig.ing} onChange={setI("ing")} /></div>
                </div>
                <div className="row">
                  <div><label htmlFor="i-posts">Posts</label><input type="number" min="0" id="i-posts" value={ig.posts} onChange={setI("posts")} /></div>
                  <div><label htmlFor="i-likes">Avg likes / post</label><input type="number" min="0" id="i-likes" value={ig.likes} onChange={setI("likes")} placeholder="Optional" /></div>
                </div>
                <div className="row">
                  <div><label htmlFor="i-upi">Seller UPI ID</label><input type="text" id="i-upi" value={ig.upi} onChange={setI("upi")} placeholder="demo.fakeshop@upi" /></div>
                  <div className="check" style={{ alignSelf: "end", paddingBottom: 12 }}>
                    <input type="checkbox" id="i-pic" checked={ig.pic} onChange={setI("pic")} />
                    <label htmlFor="i-pic" style={{ margin: 0, fontWeight: 400 }}>Has a profile photo</label>
                  </div>
                </div>
                <div className="hint">
                  <button type="button" onClick={() => setIg(EX_IG)}>Fill a suspicious profile</button>
                  <button type="button" onClick={() => setIg(EX_IG_SHOP)}>Fill a fake shop example</button>
                </div>
              </div>
            )}

            {tab === "telegram" && (
              <div>
                <label htmlFor="tg-text">Bot username, link or message</label>
                <textarea id="tg-text" value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@bot_name, t.me/bot_name, or paste what the Telegram bot sent you" />
                <div className="hint">
                  <button type="button" onClick={() => setTg(EX_TG)}>Fill a scam bot example</button>
                </div>
              </div>
            )}

            {tab === "mail" && (
              <div>
                <label htmlFor="m-from">Sender address</label>
                <input type="text" id="m-from" value={mail.from} onChange={setM("from")} placeholder="support@example.com" />
                <label htmlFor="m-sub">Subject</label>
                <input type="text" id="m-sub" value={mail.sub} onChange={setM("sub")} />
                <label htmlFor="m-body">Email body</label>
                <textarea id="m-body" value={mail.body} onChange={setM("body")} placeholder="Paste the email text" />
                <div className="hint">
                  <button type="button" onClick={() => setMail(EX_MAIL)}>Fill a phishing email example</button>
                </div>
              </div>
            )}

            <button className="go" onClick={run} disabled={busy}>{busy ? "Checking…" : "Check for scams"}</button>
          </section>

          <section className="out" aria-live="polite">
            {busy && (
              <div className="skel"><div style={{ width: "55%", height: 30 }} /><div style={{ width: "100%", height: 12 }} /><div style={{ width: "90%" }} /><div style={{ width: "75%" }} /><div style={{ width: "85%" }} /></div>
            )}
            {!busy && err && <div className="err">{err}</div>}
            {!busy && !err && res && <Result key={res.id} r={res.report} shown={res.shown} />}
            {!busy && !err && !res && (
              <div className="empty"><b>Your result appears here</b><span>Run a check on the left to see the score and the reasons.</span></div>
            )}
          </section>
        </main>

        <section className="report-card">
          <h3>Report a scam</h3>
          <p>Reports help warn the next person who checks the same UPI ID, phone number, handle or link.</p>
          <div className="report-row">
            <select aria-label="What are you reporting" value={repType} onChange={(e) => setRepType(e.target.value)}>
              <option value="upi">UPI ID</option>
              <option value="phone">Phone number</option>
              <option value="ig_handle">Instagram shop</option>
              <option value="tg_handle">Telegram bot</option>
              <option value="url">Link</option>
            </select>
            <input type="text" aria-label="Value to report" value={repVal} onChange={(e) => setRepVal(e.target.value)} placeholder="e.g. demo.fakeshop@upi or @scam_bot" />
            <button type="button" className="report-btn" onClick={submitReport} disabled={!repVal.trim()}>Submit report</button>
          </div>
          {repMsg && <div className="hint" style={{ marginTop: 10 }} role="status">{repMsg}</div>}
        </section>
      </div>

      <section className="how" id="how">
        <h2>How it works</h2>
        <ol>
          <li><b>Paste or upload</b><span>A message, screenshot, email or the details of a profile.</span></li>
          <li><b>We read the signs</b><span>Links, pressure to act fast, and requests for money or codes are checked against common scam patterns.</span></li>
          <li><b>You decide</b><span>You get a risk score and the reasons behind it, so you can act with confidence.</span></li>
        </ol>
      </section>
    </div>
  );
}
