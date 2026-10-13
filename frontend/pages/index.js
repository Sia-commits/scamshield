import Head from "next/head";
import { useState, useEffect } from "react";
import ResultCard from "../components/ResultCard";
import IncidentAssistModal from "../components/IncidentAssistModal";
import AuthModal from "../components/AuthModal";
import HistoryDrawer from "../components/HistoryDrawer";
import { useLanguage } from "../context/LanguageContext";
import {
  scanScreenshot,
  scanInstagram,
  scanTelegram,
  sendReport,
  saveScanHistory,
  fetchScanHistory,
} from "../lib/api";
import { LEARN_PLAYBOOKS } from "../lib/translations";

function FilePicker({ files, setFiles, max = 4, hint }) {
  const { t } = useLanguage();
  return (
    <div className="field">
      <label className="drop">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, max))}
        />
        <span className="drop-title">
          {files.length
            ? t("screenshots_selected", { n: files.length, s: files.length > 1 ? "s" : "" })
            : t("choose_screenshots")}
        </span>
        <span className="muted">{files.length ? files.map((f) => f.name).join(", ") : hint}</span>
      </label>
    </div>
  );
}

function MessageTab({ run, busy, prefill, onClearPrefill }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState([]);
  const [text, setText] = useState(prefill || "");

  useEffect(() => {
    if (prefill) {
      setText(prefill);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefill, onClearPrefill]);

  return (
    <div className="panel">
      <FilePicker files={files} setFiles={setFiles} hint={t("message_hint")} />
      <div className="field">
        <label htmlFor="msg">{t("or_paste")}</label>
        <textarea
          id="msg"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("message_placeholder")}
        />
      </div>
      <button
        type="button"
        className="primary"
        disabled={busy || (!files.length && !text.trim())}
        onClick={() => run(() => scanScreenshot(files, text), { type: "message", title: text.slice(0, 40) || "Screenshot message" })}
      >
        {busy ? t("checking_status") : t("check_message_btn")}
      </button>
    </div>
  );
}

function SellerCheckTab({ run, busy }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState([]);
  const [f, setF] = useState({
    username: "",
    upi: "",
    phone: "",
    followers: "",
    likes: "",
    comments: "",
    comments_status: "",
    account_age_bucket: "",
    payment_terms_type: "",
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const can = files.length || f.username || f.upi || f.phone || (f.followers && f.likes) || f.payment_terms_type || f.comments_status;

  return (
    <div className="panel">
      <FilePicker files={files} setFiles={setFiles} hint={t("seller_hint")} />

      <div className="grid2">
        <div className="field">
          <label htmlFor="u">{t("seller_username")}</label>
          <input
            id="u"
            value={f.username}
            onChange={set("username")}
            placeholder={t("seller_username_placeholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="upi">{t("seller_upi")}</label>
          <input
            id="upi"
            value={f.upi}
            onChange={set("upi")}
            placeholder={t("seller_upi_placeholder")}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="ph">{t("seller_phone")}</label>
          <input
            id="ph"
            value={f.phone}
            onChange={set("phone")}
            placeholder={t("seller_phone_placeholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="cs">{t("comments_status_label")}</label>
          <select id="cs" value={f.comments_status} onChange={set("comments_status")}>
            <option value="">{t("comments_status_open")}</option>
            <option value="off">{t("comments_status_off")}</option>
            <option value="bots">{t("comments_status_bots")}</option>
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="ab">{t("age_bucket_label")}</label>
          <select id="ab" value={f.account_age_bucket} onChange={set("account_age_bucket")}>
            <option value="">{t("age_bucket_any")}</option>
            <option value="<3m">{t("age_bucket_new")}</option>
            <option value="3-12m">{t("age_bucket_mid")}</option>
            <option value="1y+">{t("age_bucket_old")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pt">{t("payment_terms_label")}</label>
          <select id="pt" value={f.payment_terms_type} onChange={set("payment_terms_type")}>
            <option value="">{t("payment_terms_any")}</option>
            <option value="advance">{t("payment_terms_advance")}</option>
            <option value="cod">{t("payment_terms_cod")}</option>
            <option value="platform">{t("payment_terms_escrow")}</option>
          </select>
        </div>
      </div>

      <details className="manual">
        <summary>{t("manual_numbers_toggle")}</summary>
        <div className="grid2">
          <div className="field">
            <label htmlFor="fo">{t("seller_followers")}</label>
            <input id="fo" value={f.followers} onChange={set("followers")} placeholder="e.g. 25K" />
          </div>
          <div className="field">
            <label htmlFor="li">{t("seller_likes")}</label>
            <input id="li" value={f.likes} onChange={set("likes")} placeholder="e.g. 40" />
          </div>
          <div className="field">
            <label htmlFor="co">{t("seller_comments")}</label>
            <input id="co" value={f.comments} onChange={set("comments")} placeholder="e.g. 2" />
          </div>
        </div>
      </details>

      <button
        type="button"
        className="primary"
        disabled={busy || !can}
        onClick={() => run(() => scanInstagram({ files, ...f }), { type: "instagram", title: f.username ? `@${f.username} shop` : "Instagram seller check" })}
      >
        {busy ? t("checking_status") : t("check_shop_btn")}
      </button>

      {/* Safety Protocol */}
      <div className="protocol-box">
        <h4>{t("safety_protocol_title")}</h4>
        <ol className="protocol-list">
          <li>{t("safety_step_1")}</li>
          <li>{t("safety_step_2")}</li>
          <li>{t("safety_step_3")}</li>
          <li>{t("safety_step_4")}</li>
        </ol>
      </div>
    </div>
  );
}

function TelegramTab({ run, busy }) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  return (
    <div className="panel">
      <div className="field">
        <label htmlFor="tg">{t("tg_label")}</label>
        <textarea
          id="tg"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("tg_placeholder")}
        />
      </div>
      <button
        type="button"
        className="primary"
        disabled={busy || !text.trim()}
        onClick={() => run(() => scanTelegram(text), { type: "telegram", title: text.slice(0, 35) || "Telegram bot check" })}
      >
        {busy ? t("checking_status") : t("check_tg_btn")}
      </button>
    </div>
  );
}

function LearnTab({ onTestPlaybook }) {
  const { lang, t } = useLanguage();
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>{t("learn_title")}</h3>
      <p className="muted" style={{ margin: "0 0 20px" }}>{t("learn_subtitle")}</p>

      <div className="learn-grid">
        {LEARN_PLAYBOOKS.map((p) => {
          const title = lang === "hi" ? p.title_hi : p.title_en;
          const anatomy = lang === "hi" ? p.anatomy_hi : p.anatomy_en;
          return (
            <div key={p.id} className="learn-card">
              <div className="learn-card-top">
                <span className="learn-cat">{p.category}</span>
                <span className="learn-badge">{p.badge}</span>
              </div>
              <h4 className="learn-title">{title}</h4>
              <p className="learn-anatomy">
                <strong>{t("learn_anatomy")}: </strong>
                {anatomy}
              </p>
              <div className="learn-red-flags">
                <strong>{t("learn_red_flags")}:</strong>
                <ul>
                  {p.red_flags.map((rf, idx) => (
                    <li key={idx}>{rf}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="btn-test-sample"
                onClick={() => onTestPlaybook(p.sample_text)}
              >
                {t("learn_test_btn")} &rarr;
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutoTab() {
  const { t } = useLanguage();
  return (
    <div className="panel">
      <p className="roadmap-note">{t("auto_note")}</p>
      <ul className="roadmap">
        <li>
          <strong>Gmail</strong>
          <span>{t("auto_gmail_desc")}</span>
          <button type="button" disabled>{t("auto_connect_gmail")}</button>
        </li>
        <li>
          <strong>Android SMS</strong>
          <span>{t("auto_android_desc")}</span>
          <button type="button" disabled>{t("auto_get_app")}</button>
        </li>
      </ul>
      <p className="muted">{t("auto_disclaimer")}</p>
    </div>
  );
}

function ReportBox() {
  const { t } = useLanguage();
  const [type, setType] = useState("upi");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    try {
      const r = await sendReport(type, value, "");
      setMsg(`${t("report_success")} (${r.total_reports || 1})`);
      setValue("");
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <section className="report">
      <h3>{t("report_title")}</h3>
      <p className="muted">{t("report_desc")}</p>
      <div className="report-row">
        <select aria-label="What are you reporting" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="upi">{t("report_type_upi")}</option>
          <option value="phone">{t("report_type_phone")}</option>
          <option value="ig_handle">{t("report_type_ig")}</option>
          <option value="tg_handle">{t("report_type_tg")}</option>
          <option value="url">{t("report_type_url")}</option>
        </select>
        <input
          aria-label="Value to report"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("report_placeholder")}
        />
        <button type="button" onClick={submit} disabled={!value.trim()}>
          {t("report_btn")}
        </button>
      </div>
      {msg && <p className="muted" role="status">{msg}</p>}
    </section>
  );
}

export default function Home() {
  const { lang, toggleLang, t } = useLanguage();
  const [tab, setTab] = useState("message");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [lastScanMeta, setLastScanMeta] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState("");

  // Modals & Drawers state
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // User Profile & History
  const [userProfile, setUserProfile] = useState(() => {
    if (typeof window === "undefined") return { userId: "guest_user", nickname: "" };
    try {
      const stored = localStorage.getItem("scamshield_user");
      if (stored) return JSON.parse(stored);
      const generated = {
        userId: "guest_" + Math.random().toString(36).substring(2, 9),
        nickname: "",
      };
      localStorage.setItem("scamshield_user", JSON.stringify(generated));
      return generated;
    } catch {
      return { userId: "guest_user", nickname: "" };
    }
  });

  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("scamshield_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {}

    if (userProfile?.userId) {
      fetchScanHistory(userProfile.userId).then((res) => {
        if (res?.history?.length) {
          setHistory((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const merged = [...prev];
            res.history.forEach((h) => {
              if (!ids.has(h.id)) merged.push(h);
            });
            return merged;
          });
        }
      }).catch(() => {});
    }
  }, [userProfile?.userId]);

  const updateProfile = (p) => {
    setUserProfile(p);
    try {
      localStorage.setItem("scamshield_user", JSON.stringify(p));
    } catch {}
  };

  const run = async (fn, meta = { type: "message", title: "Scan" }) => {
    setBusy(true);
    setError("");
    setResult(null);
    setIsSaved(false);
    setLastScanMeta(meta);

    try {
      const res = await fn();
      setResult(res);
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveHistory = async () => {
    if (!result || isSaved) return;

    const summaryText = result.explanation?.slice(0, 200) || "";
    const item = {
      id: Date.now(),
      user_id: userProfile.userId,
      scan_type: lastScanMeta?.type || "message",
      title: lastScanMeta?.title || "Scan result",
      risk_score: result.risk_score || 0,
      verdict: result.verdict || "LOW_RISK",
      signals_count: result.signals?.length || 0,
      summary: summaryText,
      full_result: result,
      timestamp: Date.now(),
    };

    const updated = [item, ...history];
    setHistory(updated);
    setIsSaved(true);

    try {
      localStorage.setItem("scamshield_history", JSON.stringify(updated));
    } catch {}

    saveScanHistory({
      user_id: userProfile.userId,
      scan_type: item.scan_type,
      title: item.title,
      risk_score: item.risk_score,
      verdict: item.verdict,
      signals_count: item.signals_count,
      summary: summaryText,
    });
  };

  const handleSelectHistoryScan = (item) => {
    if (item.full_result) {
      setResult(item.full_result);
      setIsSaved(true);
      setError("");
    } else {
      setResult({
        risk_score: item.risk_score,
        verdict: item.verdict,
        signals: [],
        explanation: item.summary || "Loaded from history record.",
        recommended_action: "Review past record.",
      });
      setIsSaved(true);
    }
  };

  const handleDeleteHistoryScan = (id) => {
    const filtered = history.filter((h) => (h.id || h.timestamp) !== id);
    setHistory(filtered);
    try {
      localStorage.setItem("scamshield_history", JSON.stringify(filtered));
    } catch {}
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("scamshield_history");
    } catch {}
  };

  const handleTestPlaybook = (sampleText) => {
    setTab("message");
    setPrefillMessage(sampleText);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const switchTab = (id) => {
    setTab(id);
    setResult(null);
    setError("");
    setIsSaved(false);
  };

  const TABS = [
    { id: "message", label: t("tab_message") },
    { id: "instagram", label: t("tab_seller") },
    { id: "telegram", label: t("tab_telegram") },
    { id: "learn", label: t("tab_learn") },
    { id: "auto", label: t("tab_auto") },
  ];

  return (
    <>
      <Head>
        <title>{`${t("app_title")}: ${lang === "hi" ? "विश्वास करने से पहले जांचें" : "check before you trust"}`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>


      <main className="wrap">
        {/* Navigation Bar */}
        <nav className="top-nav">
          <div className="nav-brand">
            <span style={{ color: "var(--brand)" }}>Scam</span>
            <span style={{ color: "var(--high)" }}>Shield</span>
          </div>

          <div className="nav-actions">
            {/* Language Toggle */}
            <button
              type="button"
              className="pill-btn"
              onClick={toggleLang}
              aria-label="Toggle language"
              title="Switch language (EN / हिंदी)"
            >
              {lang === "hi" ? "हिंदी (HI)" : "English (EN)"}
            </button>

            {/* Guest / Profile */}
            <button
              type="button"
              className="pill-btn"
              onClick={() => setShowAuthModal(true)}
              title="Guest session profile"
            >
              &#128100; {userProfile?.nickname || t("guest_btn")}
            </button>

            {/* My History */}
            <button
              type="button"
              className="pill-btn"
              onClick={() => setShowHistoryDrawer(true)}
              title="Saved scans history"
            >
              &#128340; {t("history_btn")}
              {history.length > 0 && <span className="count-badge">{history.length}</span>}
            </button>
          </div>
        </nav>

        {/* Emergency Assistance Banner */}
        <div className="emergency-banner">
          <span className="emergency-banner-text">&#9888; {t("emergency_banner_text")}</span>
          <button
            type="button"
            className="emergency-banner-btn"
            onClick={() => setShowIncidentModal(true)}
          >
            {t("emergency_banner_btn")} &rarr;
          </button>
        </div>

        {/* Hero Header */}
        <header>
          <h1>{t("header_headline")}</h1>
          <p className="lede">{t("header_sub")}</p>
        </header>

        {/* Tab Navigation */}
        <div className="tabs" role="tablist">
          {TABS.map((tItem) => (
            <button
              key={tItem.id}
              role="tab"
              aria-selected={tab === tItem.id}
              className={tab === tItem.id ? "active" : ""}
              onClick={() => switchTab(tItem.id)}
            >
              {tItem.label}
            </button>
          ))}
        </div>

        {/* Active Tab Panel */}
        {tab === "message" && (
          <MessageTab
            run={run}
            busy={busy}
            prefill={prefillMessage}
            onClearPrefill={() => setPrefillMessage("")}
          />
        )}
        {tab === "instagram" && <SellerCheckTab run={run} busy={busy} />}
        {tab === "telegram" && <TelegramTab run={run} busy={busy} />}
        {tab === "learn" && <LearnTab onTestPlaybook={handleTestPlaybook} />}
        {tab === "auto" && <AutoTab />}

        {/* Running & Error Indicators */}
        {busy && <p className="working" role="status">{t("checking_status")}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {/* Digital Trust Report Result Card */}
        <ResultCard
          result={result}
          onSaveHistory={handleSaveHistory}
          isSaved={isSaved}
          onOpenIncidentAssist={() => setShowIncidentModal(true)}
        />

        {/* Community Report Box */}
        <ReportBox />

        {/* Footer */}
        <footer>{t("footer_text")}</footer>
      </main>

      {/* Modals & Drawers */}
      <IncidentAssistModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        userProfile={userProfile}
        onUpdateProfile={updateProfile}
      />

      <HistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        history={history}
        onSelectScan={handleSelectHistoryScan}
        onDeleteScan={handleDeleteHistoryScan}
        onClearHistory={handleClearHistory}
      />
    </>
  );
}
