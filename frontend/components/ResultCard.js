import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function ResultCard({
  result,
  onSaveHistory,
  isSaved,
  onOpenIncidentAssist,
}) {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const {
    risk_score,
    verdict,
    signals = [],
    explanation,
    recommended_action,
    summary_hi,
    action_steps_hi,
    extracted,
    disclaimer,
  } = result;

  const cls = verdict === "HIGH_RISK" ? "high" : verdict === "SUSPICIOUS" ? "mid" : "low";

  // Bilingual text display
  const displayExplanation = lang === "hi" && summary_hi ? summary_hi : explanation;
  const displayAction = lang === "hi" && action_steps_hi ? action_steps_hi : recommended_action;
  const displayVerdict = t(`verdict_${verdict}`) || verdict;

  const getSourceLabel = (src) => {
    if (src === "rule") return t("source_rule");
    if (src === "ai") return t("source_ai");
    if (src === "community") return t("source_community");
    if (src === "url") return t("source_url");
    return src;
  };

  const handleCopy = () => {
    const text = `ScamShield Trust Report
Risk Score: ${risk_score}/100 (${displayVerdict})
Summary: ${displayExplanation}
Recommended Action: ${displayAction}
Detected Signals:
${signals.map((s) => `- [${getSourceLabel(s.source)}] ${s.name}: ${s.detail}`).join("\n")}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className={`result ${cls}`} aria-live="polite">
      {/* Verdict & Score */}
      <div className="verdict">
        <div className="score">
          {risk_score}
          <span>/100</span>
        </div>
        <div>
          <h2>{displayVerdict}</h2>
          <p className="explain">{displayExplanation}</p>
        </div>
      </div>

      {/* Segmented Meter */}
      <div className="meter" role="img" aria-label={`Risk score ${risk_score} out of 100`}>
        <div className="zones">
          <i />
          <i />
          <i />
        </div>
        <div className="pin" style={{ left: `${Math.min(99, Math.max(1, risk_score))}%` }} />
      </div>
      <div className="meter-legend">
        <span>{lang === "hi" ? "कम जोखिम" : "Low"}</span>
        <span>{lang === "hi" ? "संदिग्ध" : "Suspicious"}</span>
        <span>{lang === "hi" ? "उच्च जोखिम" : "High"}</span>
      </div>

      {/* Emergency Callout for High / Suspicious */}
      {(verdict === "HIGH_RISK" || verdict === "SUSPICIOUS") && (
        <div className="incident-callout">
          <div>
            <strong>{t("already_paid_callout")}</strong>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.88rem" }}>
              {lang === "hi"
                ? "गोल्डन ऑवर (120 मिनट) में बैंक और 1930 हेल्पलाइन पर शिकायत दर्ज करके पैसे रोके जा सकते हैं।"
                : "Act within the 120-minute Golden Hour to freeze accounts and initiate dispute protocol."}
            </p>
          </div>
          <button
            type="button"
            className="incident-action-btn"
            onClick={onOpenIncidentAssist}
          >
            {t("open_incident_assist")} &rarr;
          </button>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="report-actions-bar">
        <button type="button" className="action-pill-btn" onClick={handleCopy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? t("copied_summary") : t("copy_summary")}
        </button>

        <button type="button" className="action-pill-btn" onClick={handlePrint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          {t("print_report")}
        </button>

        {onSaveHistory && (
          <button
            type="button"
            className={`action-pill-btn ${isSaved ? "saved" : ""}`}
            onClick={onSaveHistory}
            disabled={isSaved}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {isSaved ? t("already_saved") : t("save_to_history")}
          </button>
        )}
      </div>

      {/* Signals / Evidence Breakdown */}
      <h3>{t("evidence_breakdown")}</h3>
      {signals.length === 0 ? (
        <p className="muted">{t("no_signals")}</p>
      ) : (
        <ul className="signals">
          {signals.map((s, i) => (
            <li key={i} className={`sev-${s.severity}`}>
              <div className="sig-head">
                <strong>{s.name}</strong>
                <span className="tag">{getSourceLabel(s.source)}</span>
              </div>
              <p>{s.detail}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Recommended Action */}
      <h3>{t("what_to_do")}</h3>
      <p>{displayAction}</p>

      {/* Unverified Aspects */}
      <div className="unverified-box">
        <strong>{t("unverified_aspects")}</strong>
        <p>{t("unverified_desc")}</p>
      </div>

      {/* Technical Extraction Details */}
      {extracted && Object.keys(extracted).length > 0 && (
        <details>
          <summary>{t("details_read")}</summary>
          <pre>{JSON.stringify(extracted, null, 2)}</pre>
        </details>
      )}

      <p className="disclaimer">{disclaimer || t("disclaimer")}</p>
    </section>
  );
}
