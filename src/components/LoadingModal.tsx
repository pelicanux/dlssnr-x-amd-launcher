import React from "react";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  message: string;
}

export const LoadingModal: React.FC<Props> = ({ message }) => {
  const { t } = useI18n();
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: "400px", textAlign: "center", padding: "2rem" }}>
        <h3 className="modal-title" style={{ justifyContent: "center", borderBottom: "none" }}>{t("loadingModal", "wait")}</h3>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
          
          <div style={{ width: "48px", height: "48px", position: "relative" }}>
             <svg width="48" height="48" viewBox="0 0 36 36" style={{ animation: "spin 1s linear infinite" }}>
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="4"
                />
                <path
                  strokeDasharray="30, 100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
             </svg>
          </div>
          
          <p style={{ margin: 0, fontSize: "1rem", color: "#e2e8f0" }}>{message}</p>
        </div>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
