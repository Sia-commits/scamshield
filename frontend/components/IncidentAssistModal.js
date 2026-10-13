import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function IncidentAssistModal({ isOpen, onClose }) {
  const { lang, t } = useLanguage();
  const [bank, setBank] = useState("");
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("en-IN") + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  });
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copied1930, setCopied1930] = useState(false);

  if (!isOpen) return null;

  const handleCopy1930 = () => {
    navigator.clipboard.writeText("1930");
    setCopied1930(true);
    setTimeout(() => setCopied1930(false), 2500);
  };

  const generateLetter = () => {
    const b = bank.trim() || "[Bank Name]";
    const u = utr.trim() || "[UTR / Transaction Reference ID]";
    const a = amount.trim() || "[Amount in INR]";
    const dt = dateStr.trim() || "[Date & Time]";

    if (lang === "hi") {
      return `विषय: तत्काल: धोखाधड़ी लेनदेन विवाद (Fraudulent Transaction Dispute) - UTR: ${u} - खाता फ्रीज एवं चार्जबैक अनुरोध

सेवा में,
शाखा प्रबंधक / नोडल ग्रीवेंस अधिकारी,
${b}

महोदय / महोदया,

मैं यह औपचारिक शिकायत तत्काल दर्ज करवा रहा/रही हूँ कि मेरे खाते से धोखाधड़ी (Cyber Financial Fraud) के माध्यम से एक अनधिकृत लेनदेन हुआ है।

लेनदेन का विवरण:
- बैंक का नाम: ${b}
- ट्रांजैक्शन आईडी / UTR संख्या: ${u}
- कटी हुई राशि: ₹${a}
- लेनदेन का समय एवं दिनांक: ${dt}
- मोड: UPI / Netbanking

आरबीआई (RBI) के सर्कुलर DBR.No.Leg.BC.78/09.07.005/2017-18 के तहत, अनधिकृत इलेक्ट्रॉनिक लेनदेन की शून्य/सीमित देयता (Zero/Limited Liability) हेतु मैंने तत्काल 24/7 हेल्पलाइन एवं 1930 (National Cybercrime Reporting Portal) पर रिपोर्ट दर्ज कराई है।

अनुरोध:
1. कृपया प्राप्तकर्ता (beneficiary) के खाते में इस राशि को तत्काल फ्रीज (Lien / Hold) करें ताकि पैसा आगे न निकाला जा सके।
2. इस लेनदेन का चार्जबैक / रिवर्सल प्रोसेस शुरू करें।
3. मुझे पावती (Acknowledgement Number) एवं जांच संदर्भ संख्या प्रदान करें।

धन्यवाद,
[पीड़ित का नाम]
[खाता संख्या / मोबाइल नंबर]`;
    }

    return `Subject: URGENT: Fraudulent Transaction Dispute - UTR: ${u} - Request for Account Freeze and Charge Reversal

To,
The Nodal Grievance Officer / Fraud Monitoring Cell,
${b}

Dear Sir/Madam,

I am writing to formally report an unauthorized fraudulent transaction executed from my account. I have been defrauded and request immediate intervention to prevent further dispersal of funds.

Incident & Transaction Details:
- Bank Name: ${b}
- UTR / Transaction Reference ID: ${u}
- Disputed Amount: INR ₹${a}
- Date & Time: ${dt}
- Payment Channel: UPI / Netbanking

In accordance with RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18 on Customer Protection (Limiting Liability in Unauthorized Electronic Banking Transactions), I am notifying the bank within the Golden Hour window. This incident is simultaneously reported to the National Cybercrime Reporting Portal (Helpline 1930).

Urgent Action Requested:
1. Immediately place a lien / freeze on the beneficiary account for the disputed amount to prevent siphoning.
2. Initiate a recall / chargeback protocol through NPCI/UPI clearing channels.
3. Provide a formal complaint acknowledgement number and dispute reference.

Sincerely,
[Your Full Name]
[Account Number / Registered Mobile Number]`;
  };

  const handleCopyLetter = () => {
    navigator.clipboard.writeText(generateLetter());
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 3000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="badge emergency-badge">{lang === "hi" ? "आपातकालीन सहायता" : "EMERGENCY PROTOCOL"}</span>
            <h2 style={{ margin: "8px 0 4px" }}>{t("incident_title")}</h2>
            <p className="muted" style={{ margin: 0 }}>{t("incident_sub")}</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="modal-body">
          {/* Golden Hour */}
          <section className="golden-box">
            <h3>{t("golden_hour_title")}</h3>
            <ol className="golden-steps">
              <li>{t("golden_step_1")}</li>
              <li>{t("golden_step_2")}</li>
              <li>{t("golden_step_3")}</li>
            </ol>
            <div className="helpline-actions">
              <a href="tel:1930" className="btn-call">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {t("dial_1930_btn")}
              </a>
              <button className="btn-secondary" onClick={handleCopy1930}>
                {copied1930 ? (lang === "hi" ? "कॉपी हो गया!" : "Copied!") : t("copy_1930_btn")}
              </button>
              <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                {t("open_portal_btn")} &rarr;
              </a>
            </div>
          </section>

          {/* Dispute Letter Generator */}
          <section className="template-box">
            <h3>{t("template_generator_title")}</h3>
            <p className="muted" style={{ margin: "0 0 16px" }}>{t("template_generator_desc")}</p>

            <div className="grid2">
              <div className="field">
                <label>{t("bank_name_label")}</label>
                <input
                  type="text"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder={t("bank_name_placeholder")}
                />
              </div>
              <div className="field">
                <label>{t("utr_label")}</label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder={t("utr_placeholder")}
                />
              </div>
              <div className="field">
                <label>{t("amount_label")}</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t("amount_placeholder")}
                />
              </div>
              <div className="field">
                <label>{t("date_label")}</label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                />
              </div>
            </div>

            <div className="letter-preview">
              <pre>{generateLetter()}</pre>
            </div>

            <button className="primary" style={{ marginTop: "12px", width: "100%" }} onClick={handleCopyLetter}>
              {copiedTemplate ? t("copied_template_btn") : t("copy_template_btn")}
            </button>
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t("close_btn")}</button>
        </div>
      </div>
    </div>
  );
}
