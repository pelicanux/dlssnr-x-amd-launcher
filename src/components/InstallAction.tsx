import React from "react";
import { isInstalledMod } from "../services/installationStatus";
import { MenuIcon } from "./MenuIcon";

import { useI18n } from "../i18n/I18nContext";

interface Props {
  onInstall: () => void;
  onUninstall: () => void;
  loading: boolean;
  disabled?: boolean;
  temporarilyBlocked?: boolean;
  onShowInstructions?: () => void;
  installStatus?: string;
}

/**
 * Component for the primary installation button only.
 * The uninstall button is shown separately in the game info panel when mod is already installed.
 */
export const InstallAction: React.FC<Props> = ({ onInstall, loading, disabled, temporarilyBlocked, installStatus }) => {
  const { t } = useI18n();
  const isInstalled = isInstalledMod(installStatus);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%" }}>
      <button
        className={`primary ${isInstalled ? "repair-action" : ""}`}
        onClick={() => { if (!temporarilyBlocked) onInstall(); }}
        disabled={loading || disabled}
        aria-disabled={loading || disabled || temporarilyBlocked || undefined}
        style={{ width: "100%", fontSize: "1rem", padding: "0.75rem 1rem", whiteSpace: "nowrap" }}
      >
        {!loading && <MenuIcon name={isInstalled ? "repair" : "download"} />}
        <span className="install-action-label">
          {loading ? t("installAction", "loading") : (isInstalled ? <span className="repair-action-lines"><span>{t("installation", "repairTop")}</span><span>{t("installation", "repairBottom")}</span></span> : t("installAction", "install"))}
        </span>
      </button>
    </div>
  );
};
