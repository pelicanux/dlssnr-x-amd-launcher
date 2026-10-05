import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { openDirectoryPicker } from "../services/tauriService";
import { ModelSourceSelector } from "./ModelSourceSelector";
import { ModelSource } from "../types/installer";

import { useI18n } from "../i18n/I18nContext";

export interface AppConfig {
  steamgriddb_api_key?: string;
  backend: string;
  dll_version: string;
  shortcut_key: string;
  custom_game_paths?: Record<string, string>;
}

interface DetectedGpu { model: string; pciAddress: string; backend: "rdna3" | "rdna4" | null; primary: boolean; }

interface Props {
  onComplete: (config: AppConfig) => void;
  allowCancel?: boolean;
  onCancel?: () => void;
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

export const SetupWizard: React.FC<Props> = ({ onComplete, allowCancel, onCancel }) => {
  const { t, language, setLanguage } = useI18n();
  const [gpuArch, setGpuArch] = useState<"rdna4" | "rdna3">("rdna4");
  const [gpus, setGpus] = useState<DetectedGpu[]>([]);
  const [detectingGpu, setDetectingGpu] = useState(true);
  const [gpuRevision, setGpuRevision] = useState(0);
  const recommendedGpu = gpus.find(gpu => gpu.backend);
  const gpuCompatible = !detectingGpu && !!recommendedGpu;

  useEffect(() => {
    let active = true;
    setDetectingGpu(true);
    invoke<DetectedGpu[]>("detect_linux_gpus").then(result => {
      if (!active) return;
      setGpus(result);
      const recommended = result.find(gpu => gpu.backend)?.backend;
      if (recommended) setGpuArch(recommended);
    }).catch(() => { if (active) setGpus([]); })
      .finally(() => { if (active) setDetectingGpu(false); });
    return () => { active = false; };
  }, [gpuRevision]);

  const [modelSource, setModelSource] = useState<ModelSource>("bin");
  const [dllPath, setDllPath] = useState("");
  const [binPath, setBinPath] = useState("");
  const [hasCachedBin, setHasCachedBin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [speedStr, setSpeedStr] = useState("");
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(true);
  const [versionStatus, setVersionStatus] = useState<BackendVersionStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractingDll, setExtractingDll] = useState(false);

  useEffect(() => {
    let active = true;
    setHasCachedBin(false);
    setBinPath("");
    if (!gpuCompatible) return;
    invoke<string | null>("check_cached_bin", { bitness: "64", gpuArch })
      .then(path => { if (active && path) { setHasCachedBin(true); setBinPath(path); } })
      .catch(() => {});
    return () => { active = false; };
  }, [gpuArch, gpuCompatible]);

  useEffect(() => {
    let active = true;
    setVersionStatus(null);
    setDownloadComplete(false);
    if (!gpuCompatible) return;
    const checkVersion = async () => {
      setCheckingVersion(true);
      setDownloadComplete(false);
      try {
        const status = await invoke<BackendVersionStatus>("check_backend_version", { gpuArch });
        if (!active) return;
        setVersionStatus(status);
        if (status.current && !status.needs_update) {
          setDownloadComplete(true);
        } else {
          setDownloadComplete(false);
        }
      } catch (err) {
        console.error("Failed to check version:", err);
      } finally {
        if (active) setCheckingVersion(false);
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
      active = false;
      unlisten.then(f => f()).catch(() => {});
    };
  }, [gpuArch, gpuCompatible]);

  const handleDownload = async () => {
    if (!gpuCompatible || isDownloading) return;
    
    setIsDownloading(true);
    setProgressPct(0);
    setSpeedStr("");
    setDownloadComplete(false);
    setErrorMsg(null);
    
    try {
      await invoke<string>("update_backend", { gpuArch });
      setDownloadComplete(true);
      const vStatus = await invoke<BackendVersionStatus>("check_backend_version", { gpuArch }).catch(() => null);
      if (vStatus) setVersionStatus(vStatus);
    } catch (err: any) {
      if (err === "Download cancelado pelo usuário.") {
        invoke("delete_backend", { gpuArch }).catch(console.error);
        console.log("Download cancelado.");
      } else {
        console.error(err);
        setErrorMsg(t("setupWizard", "downloadError") + err);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await invoke("cancel_update");
    setIsDownloading(false);
  };

  const handleLocalFolder = async () => {
    if (!gpuCompatible) return;
    const path = await openDirectoryPicker(t("setupWizard", "selectLocalFolderPrompt"));
    if (!path) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await invoke<string>("copy_local_backend", { sourcePath: path, gpuArch });
      setDownloadComplete(true);
      const vStatus = await invoke<BackendVersionStatus>("check_backend_version", { gpuArch }).catch(() => null);
      if (vStatus) setVersionStatus(vStatus);
    } catch (err) {
      console.error(err);
      setErrorMsg(t("setupWizard", "copyError"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!gpuCompatible) return;
    setErrorMsg(null);
    if (!downloadComplete) {
      setErrorMsg(t("setupWizard", "pleaseDownload"));
      return;
    }

    setLoading(true);
    // Give browser time to paint the loading state
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      let selectedPath = modelSource === "dll" ? dllPath : binPath;
      if (!selectedPath) {
        setErrorMsg(t("setupWizard", "selectFile"));
        setLoading(false);
        return;
      }
      
      if (modelSource === "dll") {
        setExtractingDll(true);
        // Give browser time to paint the extraction loading animation (two frames to be safe)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))));
        try {
          selectedPath = await invoke<string>("extract_dll_wizard", { dllPath: selectedPath, gpuArch });
        } catch (err: any) {
          setErrorMsg(t("setupWizard", "extractError") + err);
          setExtractingDll(false);
          setLoading(false);
          return;
        }
        setExtractingDll(false);
      }
      
      const config: AppConfig = {
        backend: gpuArch === "rdna4" ? "AMDNR" : "OptiScaler",
        dll_version: selectedPath,
        shortcut_key: "Insert"
      };
      
      await invoke("save_app_config", { config });
      onComplete(config);
    } catch (err) {
      console.error("Failed to save config:", err);
      setErrorMsg(t("setupWizard", "saveError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: "50px", left: 0, right: 0, height: "calc(100vh - 50px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} />
      
      <div className="modal-content dialog-glass setup-wizard" style={{ padding: "2.5rem", width: "90%", maxWidth: "800px", zIndex: 1, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        
        {/* Top Right Controls */}
        <div style={{ position: "absolute", top: "2rem", right: "2.5rem", zIndex: 50, display: "flex", gap: "0.8rem", alignItems: "center" }}>
          
          {/* Language Selector */}
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-secondary"
              onClick={(e) => { e.stopPropagation(); setShowLangDropdown(!showLangDropdown); }}
              style={{ 
                background: "rgba(0,0,0,0.3)", color: "#ED1C24", border: "1px solid rgba(255,255,255,0.1)", 
                borderRadius: "4px", padding: "0.4rem 0.6rem", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.4rem"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              {language === "pt" ? "BR" : "EN"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          {showLangDropdown && (
            <div style={{ 
              position: "absolute", top: "100%", right: 0, marginTop: "4px", 
              background: "#1e1e2f", border: "1px solid rgba(255,255,255,0.1)", 
              borderRadius: "6px", overflow: "hidden", zIndex: 100,
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
            }}>
              <div 
                onClick={() => { setLanguage("pt"); setShowLangDropdown(false); }}
                style={{ padding: "0.5rem 1.5rem", cursor: "pointer", background: language === "pt" ? "rgba(237, 28, 36, 0.2)" : "transparent", color: language === "pt" ? "#ED1C24" : "#e2e8f0" }}
              >Português (BR)</div>
              <div 
                onClick={() => { setLanguage("en"); setShowLangDropdown(false); }}
                style={{ padding: "0.5rem 1.5rem", cursor: "pointer", background: language === "en" ? "rgba(237, 28, 36, 0.2)" : "transparent", color: language === "en" ? "#ED1C24" : "#e2e8f0" }}
              >English (EN)</div>
            </div>
          )}
          </div>
          
          {/* Close Button (Only if allowCancel is true) */}
          {allowCancel && onCancel && (
            <button
              aria-label="Fechar configuração inicial"
              className="wizard-close-button"
              onClick={onCancel}
              style={{
                background: "rgba(237, 28, 36, 0.2)", border: "1px solid rgba(237, 28, 36, 0.5)", color: "#f87171", 
                borderRadius: "50%", width: "36px", height: "36px", display: "flex", 
                alignItems: "center", justifyContent: "center", cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(237, 28, 36, 0.4)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(237, 28, 36, 0.2)"; e.currentTarget.style.color = "#f87171"; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <h2 style={{ margin: "0 0 0.5rem 0", color: "#ffffff", fontFamily: "'Rajdhani', sans-serif", fontSize: "2.5rem", paddingRight: "80px" }}>
          {t("setupWizard", "title")}
        </h2>
        <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
          {t("setupWizard", "subtitle")}
        </p>
        
        <div role="status" aria-live="polite" style={{ padding: "1rem", marginBottom: "1.2rem", borderRadius: "10px", border: `1px solid ${gpuCompatible ? "#10b98166" : "#f8717166"}`, background: "rgba(255,255,255,0.03)", color: gpuCompatible ? "#6ee7b7" : "#fca5a5" }}>
          {detectingGpu ? t("setupWizard", "gpuChecking") : <>
            {gpus.length > 0 && <div>{t("setupWizard", "gpuDetected")}: {gpus.map(gpu => gpu.model).join(" · ")}</div>}
            <div style={{ marginTop: "0.4rem" }}>{gpuCompatible
              ? `${t("setupWizard", "gpuRecommendation")}: ${recommendedGpu?.backend === "rdna4" ? "DLSSNR-AMD (RDNA 4 / RX 9000)" : "DLSSNR-RDNA3 (RDNA 3 / RX 7000)"}`
              : t("setupWizard", gpus.length ? "gpuIncompatible" : "gpuUnknown")}</div>
            {!gpuCompatible && <button className="btn btn-secondary" style={{ marginTop: "0.7rem" }} onClick={() => setGpuRevision(value => value + 1)}>{t("setupWizard", "gpuRetry")}</button>}
          </>}
        </div>
        <fieldset disabled={!gpuCompatible} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, opacity: gpuCompatible ? 1 : 0.45 }}>
        <div className="backend-options" style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem" }}>
          <div className={`backend-option ${gpuArch === "rdna4" ? "active" : ""}`}
            style={{ 
              flex: 1, padding: "1.5rem", borderRadius: "12px", cursor: "pointer",
              border: gpuArch === "rdna4" ? "2px solid #ED1C24" : "1px solid rgba(255,255,255,0.1)",
              background: gpuArch === "rdna4" ? "rgba(237, 28, 36, 0.05)" : "transparent",
              transition: "all 0.2s"
            }}
            aria-disabled={!gpuCompatible || isDownloading || loading}
            onClick={() => { if (gpuCompatible && !isDownloading && !loading) setGpuArch("rdna4"); }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0, color: gpuArch === "rdna4" ? "#ED1C24" : "#e2e8f0", fontSize: "1.4rem", fontFamily: "'Rajdhani', sans-serif" }}>DLSSNR-AMD</h3>
              <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(237, 28, 36, 0.15)", color: "#f87171", fontWeight: "bold", border: "1px solid rgba(237, 28, 36, 0.3)" }}>RDNA 4 / RX 9000</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button onClick={(e) => { e.stopPropagation(); openUrl("https://github.com/mochizuki0323/DLSSNR-AMD"); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.2rem", fontSize: "0.8rem", color: "#60a5fa", display: "flex", alignItems: "center", gap: "0.4rem", textDecoration: "none", borderRadius: "4px" }} title={t("setupWizard", "viewOnGithub")}>
                <span style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 600 }}>by mochizuki0323</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "1rem", lineHeight: "1.5" }}>
              {t("setupWizard", "rdna4Desc")}
              {recommendedGpu?.backend === "rdna4" && <span style={{ display: "block", color: "#6ee7b7", fontWeight: 600, marginTop: "0.5rem" }}>✓ {t("setupWizard", "recommended")}</span>}
            </p>
          </div>

          <div className={`backend-option ${gpuArch === "rdna3" ? "active" : ""}`}
            style={{ 
              flex: 1, padding: "1.5rem", borderRadius: "12px", cursor: "pointer",
              border: gpuArch === "rdna3" ? "2px solid #ED1C24" : "1px solid rgba(255,255,255,0.1)",
              background: gpuArch === "rdna3" ? "rgba(237, 28, 36, 0.05)" : "transparent",
              transition: "all 0.2s"
            }}
            aria-disabled={!gpuCompatible || isDownloading || loading}
            onClick={() => { if (gpuCompatible && !isDownloading && !loading) setGpuArch("rdna3"); }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0, color: gpuArch === "rdna3" ? "#ED1C24" : "#e2e8f0", fontSize: "1.4rem", fontFamily: "'Rajdhani', sans-serif" }}>DLSSNR-RDNA3</h3>
              <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "rgba(237, 28, 36, 0.15)", color: "#f87171", fontWeight: "bold", border: "1px solid rgba(237, 28, 36, 0.3)" }}>RDNA 3 / RX 7000</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button onClick={(e) => { e.stopPropagation(); openUrl("https://github.com/mauri870/DLSSNR-RDNA3"); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.2rem", fontSize: "0.8rem", color: "#60a5fa", display: "flex", alignItems: "center", gap: "0.4rem", textDecoration: "none", borderRadius: "4px" }} title={t("setupWizard", "viewOnGithub")}>
                <span style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 600 }}>by mauri870</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "1rem", lineHeight: "1.5" }}>
              {t("setupWizard", "rdna3Desc")}
              {recommendedGpu?.backend === "rdna3" && <span style={{ display: "block", color: "#6ee7b7", fontWeight: 600, marginTop: "0.5rem" }}>✓ {t("setupWizard", "recommended")}</span>}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div style={{ fontSize: "0.85rem", color: "#f87171", background: "rgba(248, 113, 113, 0.1)", padding: "0.8rem", borderRadius: "8px", border: "1px solid rgba(248, 113, 113, 0.2)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            <span style={{ whiteSpace: "pre-wrap" }}>{errorMsg}</span>
          </div>
        )}

        <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem" }}>
          <button 
            className="btn" 
            style={{ 
              flex: 1, padding: "0.8rem", borderRadius: "8px", position: "relative",
              background: downloadComplete ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.05)",
              border: downloadComplete ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
              color: downloadComplete ? "#10b981" : "#e2e8f0",
              fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem",
              overflow: "hidden"
            }}
            disabled={checkingVersion || isDownloading || downloadComplete}
            onClick={handleDownload}
          >
            {isDownloading && (
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: `${progressPct}%`,
                background: "rgba(59, 130, 246, 0.3)", transition: "width 0.2s linear", zIndex: 0
              }} />
            )}
            <span style={{ zIndex: 1, pointerEvents: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {checkingVersion ? t("setupWizard", "verifying") :
                isDownloading ? `${t("setupWizard", "downloading")} ${Math.round(progressPct)}% ${speedStr ? `(${speedStr})` : ""}` :
                downloadComplete ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {t("setupWizard", "backendUpdated")} ({versionStatus?.current})
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {t("setupWizard", "downloadGithub")} ({gpuArch === "rdna4" ? "RDNA 4" : "RDNA 3"})
                  </>
                )}
            </span>
          </button>
          
          {isDownloading ? (
            <button 
              className="btn" 
              onClick={handleCancelDownload}
              style={{ padding: "0.8rem 1.5rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontWeight: "bold" }}
            >
              {t("setupWizard", "cancel")}
            </button>
          ) : (
            <button 
              className="btn" 
              onClick={handleLocalFolder}
              disabled={loading}
              title={t("setupWizard", "selectLocalFolderTitle")}
              style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#e2e8f0", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", fontWeight: "bold" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              {t("setupWizard", "localFiles")}
            </button>
          )}
        </div>

        <ModelSourceSelector 
          modelSource={modelSource}
          setModelSource={setModelSource}
          dllPath={dllPath}
          setDllPath={setDllPath}
          binPath={binPath}
          setBinPath={setBinPath}
          hasCachedBin={hasCachedBin}
        />

        <div style={{ marginTop: "2rem" }}>
          <button 
            onClick={handleSave}
            disabled={loading || extractingDll || !downloadComplete}
            className="btn" 
            style={{ 
              width: "100%", padding: "1rem", borderRadius: "8px", fontSize: "1.1rem", 
              fontFamily: "'Rajdhani', sans-serif",
              background: "linear-gradient(to right, #ED1C24, #b91c1c)", color: "white", fontWeight: "bold",
              border: "none", cursor: (loading || extractingDll || !downloadComplete) ? "not-allowed" : "pointer",
              boxShadow: "0 4px 15px rgba(237, 28, 36, 0.3)",
              opacity: downloadComplete ? 1 : 0.5,
              display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {(loading || extractingDll) && (
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, 
                background: "rgba(255, 255, 255, 0.2)", 
                zIndex: 0,
                animation: "fillUpFake 15s cubic-bezier(0.1, 0.7, 0.1, 1) forwards"
              }} />
            )}
            <div style={{ zIndex: 1, display: "flex", alignItems: "center", gap: "0.5rem", pointerEvents: "none" }}>
              {(loading || extractingDll) && (
                <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
              )}
              {extractingDll ? t("setupWizard", "extracting") : loading ? t("setupWizard", "saving") : t("setupWizard", "continue")}
            </div>
          </button>
        </div>
        </fieldset>
      </div>
    </div>
  );
};
