import React from "react";
import { createPortal } from "react-dom";
import "../App.css";

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  busy?: boolean;
}

export const ConfirmModal: React.FC<Props> = ({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  busy = false,
  isDanger = false 
}) => {
  return createPortal(
    <div className="modal-overlay confirmation-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: "450px", border: isDanger ? "1px solid rgba(239, 68, 68, 0.3)" : undefined }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: isDanger ? "#ef4444" : undefined }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {title}
        </h2>
        <div className="modal-body" style={{ marginTop: "1rem", marginBottom: "2rem", lineHeight: "1.5" }}>
          {message}
        </div>
        <div className="modal-actions">
          <button 
            disabled={busy}
            onClick={onCancel} 
            style={{ 
              background: "rgba(255,255,255,0.1)", 
              border: "1px solid rgba(255,255,255,0.2)" 
            }}
          >
            {cancelText}
          </button>
          <button 
            disabled={busy}
            onClick={onConfirm} 
            style={{ 
              background: isDanger ? "#ef4444" : "#10b981", 
              color: "white",
              fontWeight: "bold"
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
