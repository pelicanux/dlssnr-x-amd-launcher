import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n/I18nContext";

export const CoverContextMenuPanel = forwardRef<HTMLDivElement, { x: number; y: number; children: ReactNode }>(
  function CoverContextMenuPanel({ x, y, children }, forwardedRef) {
    const localRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState({ x, y });
    useLayoutEffect(() => {
      const bounds = localRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setPosition({ x: Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)),
        y: Math.max(58, Math.min(y, window.innerHeight - bounds.height - 8)) });
    }, [x, y]);
    return <div ref={element => {
      localRef.current = element;
      if (typeof forwardedRef === "function") forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    }} className="cover-context-menu" style={{ left: position.x, top: position.y }}>{children}</div>;
  }
);

export function SteamGridCoverHint() {
  const { t } = useI18n();
  const [configured, setConfigured] = useState(false);
  useLayoutEffect(() => {
    let active = true;
    invoke<{ steamgriddb_api_key?: string } | null>("load_app_config")
      .then(config => { if (active) setConfigured(Boolean(config?.steamgriddb_api_key?.trim())); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return <div className={`steamgrid-cover-hint ${configured ? "configured" : ""}`}>
    <p>{t("steamgrid", configured ? "configuredHint" : "missingHint")}</p>
    <button onClick={() => window.dispatchEvent(new Event("openCoverPreferences"))}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7M21 3l-9 9"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg>
      {t("steamgrid", "configure")}
    </button>
  </div>;
}
