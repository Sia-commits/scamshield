import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function AuthModal({ isOpen, onClose, userProfile, onUpdateProfile }) {
  const { lang, t } = useLanguage();
  const [nickname, setNickname] = useState(userProfile?.nickname || "");

  useEffect(() => {
    if (userProfile?.nickname) {
      setNickname(userProfile.nickname);
    }
  }, [userProfile]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onUpdateProfile({
      ...userProfile,
      nickname: nickname.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card auth-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: "0 0 4px" }}>{t("auth_title")}</h2>
            <p className="muted" style={{ margin: 0 }}>{t("auth_desc")}</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="guest-badge-display">
            <span className="guest-icon">&#128100;</span>
            <div>
              <strong>{userProfile?.nickname || (lang === "hi" ? "अतिथि उपयोगकर्ता" : "Guest User")}</strong>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {t("auth_guest_id")} <code>{userProfile?.userId}</code>
              </div>
            </div>
          </div>

          <div className="field" style={{ marginTop: "16px" }}>
            <label>{t("auth_nickname_label")}</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("auth_nickname_placeholder")}
            />
          </div>

          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "12px" }}>
            {lang === "hi"
              ? "स्कैमशील्ड में कोई पासवर्ड आवश्यक नहीं है। आपका सत्र सुरक्षित है और आपका डेटा केवल आपके डिवाइस पर सहेजा जाता है।"
              : "No password required. ScamShield is private by default and stores your scans securely on your device."}
          </p>

          <button type="submit" className="primary" style={{ width: "100%", marginTop: "12px" }}>
            {t("auth_save_btn")}
          </button>
        </form>
      </div>
    </div>
  );
}
