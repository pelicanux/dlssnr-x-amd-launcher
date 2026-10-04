import { createPortal } from "react-dom";
import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import "../App.css";

interface Props {
  title: string;
  message: string;
  type: "success" | "error";
  logs: string;
  onClose: () => void;
  onOpenSetup?: () => void;
  showLogButton?: boolean;
}

export const ResultModal: React.FC<Props> = ({ title, message, type, logs, onClose, onOpenSetup, showLogButton = true }) => {
  const [showLogs, setShowLogs] = useState(false);
  const { t } = useI18n();

  return createPortal(
    <div className="modal-overlay">
      <div className={`modal-content ${type}`} style={{ maxWidth: showLogs ? '700px' : '500px' }}>
        <h2>{title}</h2>
        <div className="modal-body">
          {message.split("\n").map((line, idx) => {
            const isWarning = line.includes(t("installation", "incompatibleTitle")) || line.includes(t("installation", "incompatibleBody"));
            return (
              <p 
                key={idx}
                style={isWarning ? {
                  color: "#f87171",
                  fontWeight: 600,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  marginTop: "0.5rem",
                  lineHeight: "1.5"
                } : { lineHeight: "1.5" }}
              >
                {line}
              </p>
            );
          })}
          
          {showLogs && (
            <div className="console" style={{ marginTop: '1.5rem', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left' }}>
              {logs}
            </div>
          )}
        </div>
        <div className="modal-actions" style={{ flexWrap: "wrap" }}>
          {onOpenSetup && <button className="btn btn-primary" onClick={onOpenSetup}>{t("installation", "openSetup")}</button>}
          {showLogButton && <button className="btn-secondary" onClick={() => setShowLogs(!showLogs)}>
            {showLogs ? t("resultModal", "hideLog") : t("resultModal", "viewLog")}
          </button>}
          <button className="btn-primary" onClick={onClose}>{t("resultModal", "close")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
