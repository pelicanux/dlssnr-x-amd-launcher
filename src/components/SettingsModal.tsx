import React, { useState, useEffect, useRef } from 'react';
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { AppConfig } from "./SetupWizard";
import { useI18n } from "../i18n/I18nContext";
import { ConfirmModal } from "./ConfirmModal";
import { ResultModal } from "./ResultModal";
import { BackendUpdaterModal } from "./BackendUpdaterModal";

interface Props {
  onClose: () => void;
  initialSection?: "general" | "covers";
  onConfigUpdated: (config: AppConfig | null) => void;
  onOpenWizard: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose, onConfigUpdated, onOpenWizard, initialSection = "general" }) => {
  const [config, setConfig] = useState<AppConfig>({
    backend: "AMDNR",
    dll_version: "0.5.1",
    shortcut_key: "Insert"
  });
  const coverKeyRef = useRef<HTMLInputElement>(null);
  const [showCoverKey, setShowCoverKey] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem("custom_folders");
    return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState<"settings" | "updater">("settings");
  const { t } = useI18n();
  const [cacheDialog, setCacheDialog] = useState<"confirm" | "success" | "error" | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheError, setCacheError] = useState("");
  const clearCache = async () => {
    if (clearingCache) return;
    setClearingCache(true);
    try {
      await invoke("clear_game_caches");
      window.dispatchEvent(new Event("gameInfoCacheCleared"));
      setCacheDialog("success");
    } catch (error) {
      setCacheError(String(error));
      setCacheDialog("error");
    } finally { setClearingCache(false); }
  };

  useEffect(() => {
    invoke<AppConfig | null>("load_app_config")
      .then((res) => {
        if (res) setConfig(res);
        setConfigReady(true);
      })
      .catch(() => setSaveError(true));
  }, []);

  useEffect(() => {
    if (initialSection === "covers" && configReady) {
      coverKeyRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
      coverKeyRef.current?.focus({ preventScroll: true });
    }
  }, [initialSection, configReady]);

  const handleSave = async () => {
    setLoading(true);
    setSaveError(false);
    try {
      await invoke("save_app_config", { config });
      window.dispatchEvent(new Event("steamGridSettingsChanged"));
      onConfigUpdated(config);
      onClose();
    } catch (err) {
      console.error("Failed to save config:", err);
      setSaveError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWizard = () => {
    onOpenWizard();
    onClose();
  };

  return (
    <div style={{ position: "fixed", top: "50px", left: 0, right: 0, height: "calc(100vh - 50px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      
      {cacheDialog === "confirm" && <ConfirmModal title={t("gameCache", "title")} message={t("gameCache", "confirm")}
        confirmText={t("gameCache", "clear")} cancelText={t("confirm", "cancel")} busy={clearingCache}
        onConfirm={clearCache} onCancel={() => setCacheDialog(null)} />}
      {(cacheDialog === "success" || cacheDialog === "error") && <ResultModal
        title={t("gameCache", cacheDialog === "success" ? "successTitle" : "errorTitle")}
        message={cacheDialog === "success" ? t("gameCache", "success") : t("gameCache", "error") + cacheError}
        type={cacheDialog === "success" ? "success" : "error"} logs="" showLogButton={false}
        onClose={() => setCacheDialog(null)} />}
      <div className="modal-content dialog-glass launcher-settings" style={{ padding: "2rem", width: "90%", maxWidth: "700px", zIndex: 1, background: "rgba(10, 5, 10, 0.95)", border: "1px solid rgba(237, 28, 36, 0.3)", borderRadius: "12px", boxShadow: "0 0 30px rgba(237, 28, 36, 0.15)" }}>
        {view === "updater" ? (
          <BackendUpdaterModal 
            gpuArch={config.backend === "AMDNR" ? "rdna4" : "rdna3"}
            onClose={() => setView("settings")}
            isEmbedded={true}
            onBack={() => setView("settings")}
          />
        ) : (
          <>
            <h2 style={{ margin: "0 0 1.5rem 0", color: "#ffffff", fontFamily: "'Rajdhani', sans-serif", fontSize: "2rem" }}>
              {t("settings", "title")}
            </h2>
            
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                <label style={{ color: "#ffffff", fontWeight: "bold", fontSize: "1rem" }}>{t("settings", "backend")}</label>
                <button
                  onClick={() => setView("updater")}
                  style={{
                    background: "rgba(237, 28, 36, 0.1)", border: "1px solid rgba(237, 28, 36, 0.3)",
                    color: "#ED1C24", padding: "0.4rem 0.8rem", borderRadius: "6px",
                    fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = "0 0 10px rgba(237,28,36,0.3)"}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = "none"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {t("app", "updateBackend")}
                </button>
              </div>

              <div className="backend-options" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div 
                  className={`backend-option ${config.backend === "AMDNR" ? "active" : ""}`}
                  onClick={() => setConfig({ ...config, backend: "AMDNR" })}
                  style={{
                    background: "rgba(20, 20, 25, 0.8)",
                    border: config.backend === "AMDNR" ? "2px solid #ED1C24" : "1px solid rgba(255, 255, 255, 0.05)",
                    boxShadow: config.backend === "AMDNR" ? "0 0 15px rgba(237, 28, 36, 0.2)" : "none",
                    borderRadius: "8px", padding: "1.5rem", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  <h4 style={{ margin: "0 0 0.8rem 0", color: config.backend === "AMDNR" ? "#ED1C24" : "#e2e8f0", fontSize: "1.2rem" }}>DLSSNR-AMD</h4>
                  <span style={{ fontSize: "0.75rem", background: config.backend === "AMDNR" ? "#ED1C24" : "rgba(255,255,255,0.05)", color: config.backend === "AMDNR" ? "#fff" : "#94a3b8", padding: "0.3rem 0.6rem", borderRadius: "4px" }}>RDNA 4 / RX 9000</span>
                </div>
                
                <div 
                  className={`backend-option ${config.backend === "OptiScaler" ? "active" : ""}`}
                  onClick={() => setConfig({ ...config, backend: "OptiScaler" })}
                  style={{
                    background: "rgba(20, 20, 25, 0.8)",
                    border: config.backend === "OptiScaler" ? "2px solid #ED1C24" : "1px solid rgba(255, 255, 255, 0.05)",
                    boxShadow: config.backend === "OptiScaler" ? "0 0 15px rgba(237, 28, 36, 0.2)" : "none",
                    borderRadius: "8px", padding: "1.5rem", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  <h4 style={{ margin: "0 0 0.8rem 0", color: config.backend === "OptiScaler" ? "#ffffff" : "#e2e8f0", fontSize: "1.2rem" }}>DLSSNR-RDNA3</h4>
                  <span style={{ fontSize: "0.75rem", background: config.backend === "OptiScaler" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", color: "#94a3b8", padding: "0.3rem 0.6rem", borderRadius: "4px" }}>RDNA 3 / RX 7000</span>
                </div>
              </div>
            </div>
        <section className="steamgrid-settings" aria-labelledby="steamgrid-settings-title">
          <h3 id="steamgrid-settings-title">{t("steamgrid", "title")}</h3>
          <p>{t("steamgrid", "description")}</p>
          <label htmlFor="steamgrid-api-key">{t("steamgrid", "keyLabel")}</label>
          <div className="steamgrid-key-controls">
            <input id="steamgrid-api-key" ref={coverKeyRef} type={showCoverKey ? "text" : "password"}
              autoComplete="off" spellCheck={false} maxLength={128} disabled={!configReady || loading}
              value={config.steamgriddb_api_key ?? ""} placeholder={t("steamgrid", "placeholder")}
              onChange={event => setConfig({ ...config, steamgriddb_api_key: event.target.value })} />
            <button type="button" onClick={() => setShowCoverKey(!showCoverKey)} aria-pressed={showCoverKey}>
              {t("steamgrid", showCoverKey ? "hide" : "show")}
            </button>
            <button type="button" disabled={!configReady || loading || !config.steamgriddb_api_key}
              onClick={() => setConfig({ ...config, steamgriddb_api_key: "" })}>{t("steamgrid", "remove")}</button>
          </div>
          <div className="steamgrid-settings-footer">
            <span>{t("steamgrid", "localOnly")}</span>
            <button type="button" onClick={() => openUrl("https://www.steamgriddb.com/profile/preferences/api").catch(() => setSaveError(true))}>
              {t("steamgrid", "getKey")} ↗
            </button>
          </div>
          <small>{t("steamgrid", "rescanHint")}</small>
        </section>
        {saveError && <p role="alert" style={{ color: "#f87171" }}>{t("setupWizard", "saveError")}</p>}
        {customFolders.length > 0 && (
          <div style={{ marginBottom: "1.5rem", marginTop: "2rem" }}>
            <label style={{ display: "block", color: "#ffffff", fontWeight: "bold", fontSize: "1rem", marginBottom: "0.5rem" }}>
              {t("settings", "manualDirs")}
            </label>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "1rem", lineHeight: "1.4" }}>
              {t("settings", "manualDirsDesc")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "150px", overflowY: "auto", paddingRight: "0.5rem" }}>
              {customFolders.map(folder => (
                <div key={folder} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "0.8rem 1rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.9rem", color: "#cbd5e1", wordBreak: "break-all" }}>{folder}</span>
                  <button 
                    onClick={() => {
                      const newFolders = customFolders.filter(f => f !== folder);
                      setCustomFolders(newFolders);
                      localStorage.setItem("custom_folders", JSON.stringify(newFolders));
                      window.dispatchEvent(new Event("refreshGames"));
                    }}
                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "0.2rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title={t("settings", "removeDir")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "1.5rem 0" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "flex-end", marginTop: "2rem" }}>
          
          <div className="settings-tools-section" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "bold" }}>{t("settings", "tools")}</span>
            <div className="settings-tools" style={{ display: "flex", gap: "0.5rem", flexWrap: "nowrap", background: "rgba(20, 20, 25, 0.5)", border: "1px solid rgba(255,255,255,0.05)", padding: "0.5rem", borderRadius: "8px" }}>
              <button 
                onClick={handleOpenWizard}
                className="btn btn-secondary" 
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem", borderRadius: "6px", color: "#60a5fa", background: "rgba(96, 165, 250, 0.05)", border: "1px solid rgba(96, 165, 250, 0.1)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 2.81-6.7L3 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 1 0-2.81 6.7L21 16"/></svg>
                {t("settings", "reset")}
              </button>

              <button 
                onClick={() => setCacheDialog("confirm")}
                className="btn btn-secondary" 
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem", borderRadius: "6px", color: "#f87171", background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.1)" }}
                title={t("gameCache", "title")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                {t("gameCache", "clear")}
              </button>
              
              <button
                onClick={() => {
                  invoke("collect_and_open_logs", { gameName: "", gameDir: "" }).catch(console.error);
                }}
                className="btn btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem", borderRadius: "6px", color: "#fbbf24", background: "rgba(251, 191, 36, 0.05)", border: "1px solid rgba(251, 191, 36, 0.1)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                {t("settings", "openLogs")}
              </button>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginLeft: "auto" }}>
            <div style={{ display: "flex", gap: "0.5rem", background: "rgba(20, 20, 25, 0.5)", border: "1px solid rgba(255,255,255,0.05)", padding: "0.5rem", borderRadius: "8px" }}>
              <button 
                onClick={onClose}
                className="btn btn-secondary" 
                style={{ padding: "0.6rem 1.5rem", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "none", color: "#ffffff", fontWeight: "bold" }}
              >
                {t("settings", "cancel")}
              </button>
              <button 
                onClick={handleSave}
                disabled={loading || !configReady}
                className="btn" 
                style={{ 
                  padding: "0.6rem 2rem", borderRadius: "6px", fontWeight: "bold", 
                  background: "#ED1C24", color: "white", border: "none",
                  boxShadow: "0 0 10px rgba(237,28,36,0.4)"
                }}
              >
                {loading ? "..." : t("settings", "save")}
              </button>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
