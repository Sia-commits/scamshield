import { useLanguage } from "../context/LanguageContext";

export default function HistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelectScan,
  onDeleteScan,
  onClearHistory,
}) {
  const { lang, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.4rem" }}>{t("history_title")}</h2>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {history.length} {history.length === 1 ? "scan" : "scans"}
            </span>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close history">&times;</button>
        </div>

        <div className="drawer-body">
          {history.length === 0 ? (
            <div className="empty-history">
              <p className="muted">{t("history_empty")}</p>
            </div>
          ) : (
            <ul className="history-list">
              {history.map((item) => {
                const isHigh = item.verdict === "HIGH_RISK" || item.risk_score >= 55;
                const isMid = item.verdict === "SUSPICIOUS" || (item.risk_score >= 25 && item.risk_score < 55);
                const tagCls = isHigh ? "sev-high" : isMid ? "sev-medium" : "sev-low";

                return (
                  <li key={item.id || item.timestamp} className="history-card">
                    <div className="history-card-top">
                      <span className={`score-pill ${isHigh ? "high" : isMid ? "mid" : "low"}`}>
                        {item.risk_score}/100
                      </span>
                      <span className="history-type-tag">
                        {item.scan_type === "message"
                          ? (lang === "hi" ? "संदेश" : "Message")
                          : item.scan_type === "instagram"
                          ? (lang === "hi" ? "दुकान" : "Shop")
                          : (lang === "hi" ? "बॉट" : "Bot")}
                      </span>
                      <span className="history-date">
                        {new Date(item.timestamp || item.created_at || Date.now()).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h4 className="history-title">{item.title || "Scan Result"}</h4>
                    {item.summary && <p className="history-summary">{item.summary}</p>}

                    <div className="history-card-actions">
                      <button
                        className="btn-reopen"
                        onClick={() => {
                          onSelectScan(item);
                          onClose();
                        }}
                      >
                        {t("history_view_btn")}
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => onDeleteScan(item.id || item.timestamp)}
                        aria-label="Delete scan"
                      >
                        {t("history_delete_btn")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {history.length > 0 && (
          <div className="drawer-footer">
            <button className="btn-clear" onClick={onClearHistory}>
              {t("history_clear")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
