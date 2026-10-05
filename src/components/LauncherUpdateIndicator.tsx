import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { DownloadProgressRing } from "./DownloadProgressRing";
import { formatDownloadSpeed } from "../services/launcherUpdates";
import type { LauncherDownloadProgress, LauncherUpdateStatus } from "../services/launcherUpdates";

export function LauncherUpdateIndicator({ status, disabled, onOpen, onCheck, downloadProgress }: {
  status: LauncherUpdateStatus;
  disabled?: boolean;
  downloadProgress?: LauncherDownloadProgress | null;
  onOpen: () => void;
  onCheck: () => void;
}) {
  const { t, language } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const available = status === "available";
  const tip = downloadProgress ? `${t("launcherUpdate", "downloading")} ${downloadProgress.percent}% · ${formatDownloadSpeed(downloadProgress.bytesPerSecond, language)}` : t("launcherUpdate", status === "checking" ? "checking" : status === "error" ? "checkFailed" : available ? "updateNotification" : "noneAvailable");
  useEffect(() => { if (disabled || !available) setMenuOpen(false); }, [disabled, available]);
  useEffect(() => {
    if (!menuOpen) return;
    menuButton.current?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  return <div ref={root} data-tauri-drag-region="false"
    className={`launcher-update-indicator launcher-update-${status} ${menuOpen ? "menu-open" : ""} ${downloadProgress ? "launcher-update-downloading" : ""}`}
    style={{ opacity: disabled && !downloadProgress && status !== "checking" ? .3 : 1 }}
    onKeyDown={event => {
      if (event.key === "Escape" && menuOpen) { event.stopPropagation(); setMenuOpen(false); trigger.current?.focus(); }
    }}>
    <button ref={trigger} type="button" className="btn-titlebar launcher-update-button"
      disabled={disabled || status === "checking" || !!downloadProgress} aria-label={tip} aria-describedby="launcher-update-tooltip"
      aria-haspopup={available ? "menu" : undefined} aria-expanded={available ? menuOpen : undefined}
      onClick={() => { if (available) setMenuOpen(open => !open); else onCheck(); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg>
      {status === "checking" && <span className="launcher-update-ring" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="18 58" strokeLinecap="round"/></svg></span>}
      {downloadProgress && <span className="launcher-download-ring"><DownloadProgressRing percent={downloadProgress.percent}/></span>}
      {available && !downloadProgress && <span className="launcher-update-dot" aria-hidden="true"/>}
    </button>
    {downloadProgress && <span className="launcher-download-speed" aria-hidden="true">{formatDownloadSpeed(downloadProgress.bytesPerSecond, language)}</span>}
    <span id="launcher-update-tooltip" role="tooltip" className="launcher-update-tooltip">{tip}</span>
    {menuOpen && <div className="launcher-update-popover" role="menu">
      <button ref={menuButton} type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpen(); }}>
        {t("launcherUpdate", "title")}
      </button>
    </div>}
  </div>;
}
