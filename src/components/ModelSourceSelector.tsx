import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModelSource } from "../types/installer";
import { openFilePicker } from "../services/tauriService";
import { useI18n } from "../i18n/I18nContext";
import { MenuIcon } from "./MenuIcon";

interface Props {
  modelSource: ModelSource;
  setModelSource: (src: ModelSource) => void;
  dllPath: string;
  setDllPath: (path: string) => void;
  binPath: string;
  setBinPath: (path: string) => void;
  hasCachedBin: boolean;
}

export const ModelSourceSelector: React.FC<Props> = ({ modelSource, setModelSource, dllPath, setDllPath, binPath, setBinPath, hasCachedBin }) => {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const [tooltip, setTooltip] = useState<React.CSSProperties | null>(null);
  const infoRef = useRef<HTMLButtonElement>(null);
  const handlePickFile = async (type: ModelSource) => {
    if (picking) return;
    setPicking(true);
    try {
      const path = await openFilePicker(type === "dll" ? "DLL/ZIP" : "Model Bin", type === "dll" ? ["dll", "zip"] : ["bin"]);
      if (path) {
        if (type === "dll") setDllPath(path);
        else setBinPath(path);
        setModelSource(type);
      }
    } catch (error) {
      console.error("Failed to select model file:", error);
    } finally { setPicking(false); }
  };
  const showInfo = () => {
    const rect = infoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(300, window.innerWidth - 32);
    setTooltip({ width, left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
      ...(window.innerHeight - rect.bottom > 180 ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }) });
  };
  useEffect(() => {
    if (!tooltip) return;
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, [tooltip]);

  return (
    <div className="card model-source-panel">
      <div className="model-source-heading">
        <MenuIcon name="cube" />
        <div className="model-source-heading-text">
          <h3>{t("modelSource", "title")}</h3>
          <p>{t("modelSource", "desc")}</p>
        </div>
        <button type="button" className="model-source-info" ref={infoRef} aria-label={t("modelSource", "info")}
          aria-describedby={tooltip ? "model-source-tooltip" : undefined}
          onMouseEnter={showInfo} onMouseLeave={() => setTooltip(null)} onFocus={showInfo} onBlur={() => setTooltip(null)}
          onKeyDown={e => { if (e.key === "Escape") setTooltip(null); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none"/></svg>
        </button>
      </div>
      <div className="model-source-options">
        <button type="button" disabled={picking} aria-pressed={modelSource === "bin"}
          className={`model-source-option ${binPath ? "model-source-option--ready" : ""}`}
          onClick={() => handlePickFile("bin")} title={binPath || t("modelSource", "selectBin")}>
          <span className="model-source-symbol">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 12h2v5H8zM14 12v5m-1-5h2m-2 5h2"/></svg>
          </span>
          <span className="model-source-option-text">
            <strong>{t("modelSource", "useExisting")}</strong>
            <span>{binPath ? t("modelSource", hasCachedBin ? "binCached" : "fileSelected") : t("modelSource", "selectBin")}</span>
            {binPath && <small>{binPath}</small>}
          </span>
        </button>
        <button type="button" disabled={picking} aria-pressed={modelSource === "dll"}
          className="model-source-option" onClick={() => handlePickFile("dll")} title={dllPath || t("modelSource", "selectDll")}>
          <span className="model-source-symbol"><MenuIcon name="document" /></span>
          <span className="model-source-option-text">
            <strong>{t("modelSource", "extractDll")}</strong>
            <span>{t("modelSource", "dllHint")}</span>
            {dllPath && <small>{dllPath}</small>}
          </span>
        </button>
      </div>
      {tooltip && createPortal(<div id="model-source-tooltip" className="model-source-tooltip" role="tooltip" style={tooltip}>
        A DLL (nvngx_dlssnr.dll) pode ser encontrada em jogos oficiais que já possuam suporte ao DLSS 5. O programa irá extrair essa DLL para gerar o arquivo dlssnr.bin necessário para o mod.
      </div>, document.body)}
    </div>
  );
};
