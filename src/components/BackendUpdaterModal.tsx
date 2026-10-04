import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openDirectoryPicker } from "../services/tauriService";
import { useI18n } from "../i18n/I18nContext";
import { ConfirmModal } from "./ConfirmModal";

interface Props {
  gpuArch: "rdna3" | "rdna4";
  onClose: () => void;
  isEmbedded?: boolean;
  onBack?: () => void;
}

interface ProgressPayload {
  downloaded: number;
  total: number;
  speed_bytes_per_sec: number;
}

interface BackendVersionStatus {
  latest: string;
  current: string | null;
  needs_update: boolean;
}

export const BackendUpdaterModal: React.FC<Props> = ({ gpuArch, onClose, isEmbedded, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [speedStr, setSpeedStr] = useState("");
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(true);
  const [versionStatus, setVersionStatus] = useState<BackendVersionStatus | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const checkVersion = async () => {
      setCheckingVersion(true);
      setDownloadComplete(false);
      try {
        const status = await invoke<BackendVersionStatus>("check_backend_version", { gpuArch });
        setVersionStatus(status);
        if (status.current && !status.needs_update) {
          setDownloadComplete(true);
        } else {
          setDownloadComplete(false);
        }
      } catch (err) {
        console.error("Failed to check version:", err);
      } finally {
        setCheckingVersion(false);
      }
    };
    checkVersion();

    const unlisten = listen<ProgressPayload>("download-progress", (event) => {
      const payload = event.payload;
      if (payload.total > 0) {
        const pct = (payload.downloaded / payload.total) * 100;
        setProgressPct(pct > 100 ? 100 : pct);
      }
      
      if (payload.speed_bytes_per_sec > 0) {
        const speedMb = payload.speed_bytes_per_sec / (1024 * 1024);
        setSpeedStr(`${speedMb.toFixed(1)} MB/s`);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [gpuArch]);

  const formatSpeed = (speed: string) => {
    if (!speed) return "";
    return `(${speed})`;
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    
    setLoading(true);
    setIsDownloading(true);
    setProgressPct(0);
    setSpeedStr("");
    setDownloadComplete(false);
    setStatus(t("updater", "preparing"));
    setError(false);
    
    try {
      const response = await invoke<string>("update_backend", { gpuArch });
      setStatus(response);
      setDownloadComplete(true);
      // Refresh version check after download
      const vStatus = await invoke<BackendVersionStatus>("check_backend_version", { gpuArch }).catch(() => null);
      if (vStatus) setVersionStatus(vStatus);
    } catch (err: any) {
      if (err === "Download cancelado pelo usuário.") {
        invoke("delete_backend", { gpuArch }).catch(console.error);
        setStatus("Download cancelado.");
        setError(false);
      } else {
        setError(true);
        setStatus(String(err));
      }
    } finally {
      setLoading(false);
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await invoke("cancel_update");
    setStatus(t("updater", "cancel"));
  };

  const handleLocalFolder = async () => {
    const path = await openDirectoryPicker(t("updater", "localFolderPrompt"));
    if (!path) return;

    setLoading(true);
    setStatus(t("updater", "copying"));
    setError(false);

    try {
      const response = await invoke<string>("copy_local_backend", { sourcePath: path, gpuArch });
      setStatus(response);
      setDownloadComplete(true);
    } catch (err) {
      setError(true);
      setStatus(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    setShowConfirmDelete(false);
    setLoading(true);
    setStatus(t("updater", "deleting"));
    setError(false);
    try {
      const response = await invoke<string>("delete_backend", { gpuArch });
      setStatus(response);
      setDownloadComplete(false);
      setProgressPct(0);
      setVersionStatus(null);
    } catch (err) {
      setError(true);
      setStatus(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke("open_backend_folder", { gpuArch });
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };


  const innerContent = (
    <div className={isEmbedded ? "" : "modal-content"} style={{ maxWidth: "480px", margin: "0 auto", animation: isEmbedded ? "fade-in 0.3s ease" : undefined }}>
      {isEmbedded && onBack && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
          <button 
            onClick={onBack}
            className="btn btn-secondary backend-back-button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            {t("updater", "back")}
          </button>
        </div>
      )}
      <h3 className="modal-title" style={{ marginTop: isEmbedded ? 0 : undefined }}>{t("updater", "title")}</h3>
      
      <div className="modal-body">
        <p style={{ marginBottom: "1rem", fontSize: "0.85rem", opacity: 0.9 }}>
          {t("updater", "description")}
        </p>
        
        <div className="backend-architecture">
          <label>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            {gpuArch === "rdna4" ? `${t("updater", "currentArch")} RDNA 4 (RX 9000)` : `${t("updater", "currentArch")} RDNA 3 (RX 7000)`}
          </label>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginBottom: "1rem" }}>
          
          <button 
            className="primary" 
            style={{ 
              padding: "0.8rem", 
              position: "relative",
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center",
              opacity: (loading && !isDownloading) ? 0.7 : 1,
              overflow: "hidden"
            }}
            disabled={checkingVersion || (loading && !isDownloading) || downloadComplete}
            onClick={!isDownloading && !downloadComplete ? handleDownload : undefined}
          >
            {/* Progress Background */}
            {isDownloading && (
              <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progressPct}%`,
                background: "rgba(255,255,255,0.2)",
                transition: "width 0.2s linear",
                zIndex: 0
              }} />
            )}

            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold", zIndex: 1, pointerEvents: "none" }}>
              {checkingVersion ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {t("updater", "checking")}</> : 
               downloadComplete ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> {t("updater", "updated")}</> : 
               isDownloading ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> {t("updater", "downloadingPct")} {`${progressPct.toFixed(0)}% ${formatSpeed(speedStr)}`}</> :
               (versionStatus?.needs_update && versionStatus?.current) ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.58 5.58"/></svg> {t("updater", "update")}</> :
               <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> {t("updater", "downloading")}</>}
            </span>
            
            {!downloadComplete && isDownloading && (
              <div 
                onClick={handleCancelDownload}
                style={{ 
                  position: "absolute",
                  right: "0.8rem",
                  width: "24px", height: "24px", borderRadius: "50%", 
                  background: "#ef4444", display: "flex", 
                  alignItems: "center", justifyContent: "center", fontSize: "12px",
                  cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  transition: "transform 0.2s ease",
                  zIndex: 2,
                  pointerEvents: "auto"
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                ✖
              </div>
            )}
          </button>

          <button 
            onClick={handleLocalFolder} 
            disabled={loading}
            style={{ padding: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            {t("updater", "localFolder")}
          </button>

          <button 
            onClick={handleOpenFolder} 
            disabled={loading}
            style={{ padding: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
            {t("updater", "openModFolder")}
          </button>

          <button 
            onClick={handleDelete} 
            disabled={loading}
            style={{ padding: "0.8rem", color: "#f87171", border: "1px solid rgba(248, 113, 113, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            {t("updater", "delete")}
          </button>
        </div>

        {status && (
          <div style={{ 
            marginTop: "1rem", 
            padding: "0.8rem", 
            background: "rgba(0,0,0,0.3)", 
            borderRadius: "6px",
            color: error ? "#f87171" : "#86efac",
            fontSize: "0.85rem",
            wordBreak: "break-all"
          }}>
            {status}
          </div>
        )}
      </div>

      {!isEmbedded && (
        <div className="modal-actions">
          <button onClick={onClose} disabled={isDownloading}>
            {t("updater", "close")}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {showConfirmDelete && (
        <ConfirmModal 
          title={t("updater", "warning")}
          message={t("updater", "deleteConfirm")}
          isDanger={true}
          confirmText={t("updater", "deleteConfirmBtn")}
          cancelText={t("confirm", "cancel")}
          onCancel={() => setShowConfirmDelete(false)}
          onConfirm={confirmDelete}
        />
      )}
      {isEmbedded ? innerContent : (
        <div className="modal-overlay">
          {innerContent}
        </div>
      )}
    </>
  );
};
