import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useI18n } from "../i18n/I18nContext";
import { APP_BUILD_LABEL } from "../services/buildInfo";

import type { LauncherUpdateInfo } from "../services/launcherUpdates";
export function AppUpdateModal({ onClose, initialInfo }: { onClose: () => void; initialInfo?: LauncherUpdateInfo }) {
  const { t } = useI18n();
  const [info, setInfo] = useState<LauncherUpdateInfo | null>(initialInfo ?? null);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(!initialInfo);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(initialInfo?.preferred ?? null);
  const [downloaded, setDownloaded] = useState("");
  const [progress, setProgress] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const errorText = (error: unknown) => {
    const code = String(error);
    const keys = ["network", "rateLimit", "invalidRelease", "noPackage", "checksumMissing", "checksum", "apply", "download", "manualInstall", "pkexecFailed", "authCancelled", "packageInstallFailed", "restartFailed"] as const;
    return t("launcherUpdate", keys.find(key => key === code) ?? "network");
  };
  useEffect(() => {
    let active = true;
    if (!initialInfo) invoke<LauncherUpdateInfo>("check_launcher_update").then(result => {
      if (active) { setInfo(result); setSelected(result.preferred); }
    }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setBusy(false); });
    const unsubscribe = listen<number>("launcher-download-progress", e => { if (active) setProgress(e.payload); }).catch(() => () => {});
    dialog.current?.focus();
    return () => { active = false; void unsubscribe.then(stop => stop()); };
  }, []);
  const download = async () => {
    if (selected === null) return;
    setBusy(true); setError(""); setProgress(0); setDownloaded("");
    try { setDownloaded(await invoke<string>("download_launcher_update", { assetId: selected })); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { dialog.current?.focus(); }, [confirming]);
  const apply = async () => {
    setConfirming(false);
    setBusy(true); setApplying(true); setError("");
    try { await invoke("restart_launcher_update"); }
    catch (e) { setError(errorText(e)); setBusy(false); setApplying(false); }
  };
  const showFile = async () => { try { await revealItemInDir(downloaded); } catch { setError(t("launcherUpdate", "download")); } };
  const packageSelected = info?.packages.find(p => p.id === selected);
  const extension = packageSelected?.name.toLowerCase().match(/\.(appimage|deb|rpm)$/)?.[0];
  const canApply = !!extension && extension === info?.format && (extension !== ".appimage" || info?.appimage);

  return createPortal(<div className="modal-overlay" style={{ zIndex: 3000 }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="launcher-update-title" className="modal-content dialog-glass app-update-dialog" onKeyDown={e => {
      if (e.key === "Escape" && !busy) { e.stopPropagation(); if (confirming) setConfirming(false); else onClose(); }
      if (e.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex="0"]');
        if (!items?.length) { e.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <h2 id="launcher-update-title">{t("launcherUpdate", confirming ? "confirmTitle" : "title")}</h2>
      {confirming ? <>
        <p className="app-update-confirmation">{t("launcherUpdate", extension === ".appimage" ? "confirmAppImage" : "confirmPackage")}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setConfirming(false)}>{t("launcherUpdate", "later")}</button>
          <button className="btn btn-primary" onClick={apply}>{t("launcherUpdate", "installNow")}</button>
        </div>
      </> : <>
      <p className="app-update-muted">{t("launcherUpdate", "current")} {APP_BUILD_LABEL}</p>
      <div aria-live="polite">
        {!info && !error && <p>{t("launcherUpdate", "checking")}</p>}
        {info && <>
          <p>{!info.latest ? t("launcherUpdate", "noRelease") : info.available ? `${t("launcherUpdate", "available")} ${info.latest}` : t("launcherUpdate", "upToDate")}</p>
          {info.available && <>
            {info.notes && <pre className="app-update-notes" tabIndex={0}>{info.notes}</pre>}
            {info.packages.length ? <label className="app-update-package">{t("launcherUpdate", "package")}
              <select disabled={busy || !!downloaded} value={selected ?? ""} onChange={e => setSelected(Number(e.target.value))}>
                {info.packages.map(p => <option key={p.id} value={p.id}>{p.name} ({(p.size / 1048576).toFixed(1)} MB)</option>)}
              </select>
            </label> : <p>{t("launcherUpdate", "noPackage")}</p>}
            {!canApply && <p className="app-update-muted">{t("launcherUpdate", "manualInstall")}</p>}
          </>}
        </>}
        {busy && info && <div><p>{applying ? t("launcherUpdate", "applying") : `${t("launcherUpdate", "downloading")} ${progress}%`}</p>{!applying && <progress max={100} value={progress}/>}</div>}
        {!!downloaded && <p>{t("launcherUpdate", "ready")}</p>}
        {error && <p className="app-update-error" role="alert">{error}</p>}
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={async () => { try { await openUrl("https://github.com/pelicanux/dlssnr-x-amd-launcher/releases"); } catch { setError(t("launcherUpdate", "network")); } }}>{t("launcherUpdate", "releases")}</button>
        <button className="btn btn-secondary" disabled={busy} onClick={onClose}>{t("launcherUpdate", "close")}</button>
        {!!downloaded && canApply && <button className="btn btn-secondary" disabled={busy} onClick={showFile}>{t("launcherUpdate", "showFile")}</button>}
        {info?.available && !!info.packages.length && (!downloaded ? <button className="btn btn-primary" disabled={busy} onClick={download}>{t("launcherUpdate", "downloadButton")}</button> : <button className="btn btn-primary" disabled={busy} onClick={canApply ? () => setConfirming(true) : showFile}>{t("launcherUpdate", canApply ? "restart" : "showFile")}</button>)}
      </div>
      </>}
    </div>
  </div>, document.body);
}
