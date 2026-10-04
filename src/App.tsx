import { changeLocalCover, resetGameCover, reportCoverError } from "./services/customCovers";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGameAnalysis } from "./hooks/useGameAnalysis";
import { useI18n } from "./i18n/I18nContext";
import { AnimatePresence, motion } from "framer-motion";
import "./App.css";
import { MenuIcon } from "./components/MenuIcon";

// Types
import { InstallRoute } from "./types/installer";

// Services
import { isMissingModel, localizeInstallationMessage } from "./services/installationMessages";
import { runInstallation } from "./services/installerService";
import { openDirectoryPicker } from "./services/tauriService";

// Components
import { RouteSelector } from "./components/RouteSelector";
import { BitnessSelector } from "./components/BitnessSelector";
import { InstallAction } from "./components/InstallAction";
import { ResultModal } from "./components/ResultModal";
import { UninstallModal } from "./components/UninstallModal";
import { BackendUpdaterModal } from "./components/BackendUpdaterModal";
import { LoadingModal } from "./components/LoadingModal";
import { CreditsModal } from "./components/CreditsModal";
import { TitleBar } from "./components/TitleBar";
import { SetupWizard, AppConfig } from "./components/SetupWizard";
import { SettingsModal } from "./components/SettingsModal";
import { GameGrid, GameInfo } from "./components/GameGrid";
import { InstructionsModal } from "./components/InstructionsModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { ShortcutKeySelector } from "./components/ShortcutKeySelector";

import { AmbientBackground } from "./components/AmbientBackground";
import { EffectsContext } from "./components/EffectsContext";
import { APP_BUILD_LABEL } from "./services/buildInfo";
import { defaultShortcutForRoute, steamLaunchOptionsForRoute } from "./services/routeDefaults";

function App() {
  const [performanceMode, setPerformanceMode] = useState(() => localStorage.getItem("performance_mode") === "true");
  const [playGameEntrance, setPlayGameEntrance] = useState(true);
  const [effectsHaveChanged, setEffectsHaveChanged] = useState(false);
  const effectsInitialized = useRef(false);
  useLayoutEffect(() => {
    if (effectsInitialized.current) setEffectsHaveChanged(true);
    effectsInitialized.current = true;
    setPlayGameEntrance(false);
    localStorage.setItem("performance_mode", String(performanceMode));
    document.body.classList.toggle("performance-mode", performanceMode);
  }, [performanceMode]);
  const [gameDir, setGameDir] = useState("");
  const [route, setRoute] = useState<InstallRoute>("optiscaler");
  const [bitness, setBitness] = useState<"32" | "64">("64");
  const [gpuArch, setGpuArch] = useState<"rdna4" | "rdna3">("rdna4");
  const { t, language, setLanguage } = useI18n();
  const localizeAnalysisValue = (value: string) => {
    if (value === "Linux Nativo" || value === "Native Linux") return t("gameInfo", "nativeLinux");
    if (["Não detectada", "Não detectado", "Not detected"].includes(value)) return t("gameInfo", "notDetected");
    if (["Verificando...", "Checking..."].includes(value)) return t("gameInfo", "verifying");
    if (["Desconhecido", "Desconhecida", "Unknown"].includes(value)) return t("gameInfo", "unknown");
    return value;
  };
  
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [logs, setLogs] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modelRecovery, setModelRecovery] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error">("success");

  const [showUpdaterModal, setShowUpdaterModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const changeInstallRoute = (nextRoute: InstallRoute) => {
    if (nextRoute === route) return;
    setRoute(nextRoute);
    if (appConfig) {
      const nextConfig = { ...appConfig, shortcut_key: defaultShortcutForRoute(nextRoute) };
      setAppConfig(nextConfig);
      invoke("save_app_config", { config: nextConfig }).catch(console.error);
    }
  };

  const [showSettings, setShowSettings] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showEffectsDropdown, setShowEffectsDropdown] = useState(false);
  useEffect(() => {
    if (!showSettings) {
      setShowEffectsDropdown(false);
      setShowLangDropdown(false);
    }
  }, [showSettings]);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState("");
  const coverContextMenuRef = useRef<HTMLDivElement>(null);
  const [coverContextMenu, setCoverContextMenu] = useState<{ x: number, y: number } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [uiScale, setUiScale] = useState(() => {
    const saved = localStorage.getItem("ui_scale");
    return saved ? parseFloat(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem("ui_scale", uiScale.toString());
    document.documentElement.style.fontSize = `${16 * uiScale}px`;
  }, [uiScale]);

  useEffect(() => {
    invoke<AppConfig | null>("load_app_config")
      .then((res) => {
        if (res) {
          setAppConfig(res);
        } else {
          setShowSetupWizard(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load app config", err);
        setShowSetupWizard(true);
      });
  }, []);

  useEffect(() => {
    if (appConfig) {
      setGpuArch(appConfig.backend === "AMDNR" ? "rdna4" : "rdna3");
    }
  }, [appConfig]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (!coverContextMenuRef.current?.contains(event.target as Node)) setCoverContextMenu(null);
    };
    if (showSettings || coverContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings, coverContextMenu]);

  useEffect(() => {
  }, [bitness, gpuArch]);

  useEffect(() => {
    if (bitness === "32" && route === "optiscaler") {
      changeInstallRoute("reshade"); // Fallback to reshade
    }
  }, [bitness, route]);

  useEffect(() => {
    if (gpuArch === "rdna3" && bitness === "32") {
      setBitness("64");
    }
  }, [gpuArch, bitness]);

  const installationRequest = useRef(0);
  const refreshInstallationDetails = async (path: string) => {
    const request = ++installationRequest.current;
    try {
      const result = await invoke<{ status: string; installed_dll: string | null }>("get_game_installation_details", { gameDir: path });
      if (request === installationRequest.current) { setInstallStatus(result.status); setInstalledDll(result.installed_dll); }
    } catch (error) {
      console.error("Could not refresh installation details:", error);
      if (request === installationRequest.current) { setInstallStatus("Erro"); setInstalledDll(null); }
    }
  };

  const handleInstall = async () => {
    if (!gameDir) {
      setShowInstructionsModal(true);
      return;
    }
    setModelRecovery(false);
    if (!appConfig?.dll_version) {
      setModalTitle(t("app", "installFailTitle"));
      setModalMessage(t("installation", "missingModel"));
      setLogs("");
      setModalType("error");
      setModelRecovery(true);
      setShowModal(true);
      return;
    }

    setLoading(true);
    setLoadingMessage(t("app", "installingMsg"));
    setLogs(t("app", "installStarted"));
    
    // Give browser time to paint the loading modal
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const response = await runInstallation({
        gameDir,
        route,
        bitness,
        gpuArch,
        dllPath: appConfig.dll_version.endsWith('.dll') ? appConfig.dll_version : null,
        binPath: appConfig.dll_version.endsWith('.bin') ? appConfig.dll_version : null,
        shortcutKey: appConfig?.shortcut_key || defaultShortcutForRoute(route)
      });
      setLogs((prev) => prev + "\n" + localizeInstallationMessage(response, language));

      // Refresh install status
      if (selectedGame && selectedGame.path === gameDir) {
        await refreshInstallationDetails(gameDir);
      }

      const isRepair = installStatus !== "Não Instalado" && installStatus !== "Nenhum" && installStatus !== "Verificando...";
      setModalTitle(isRepair ? t("app", "repairSuccessTitle") : t("app", "installSuccessTitle"));
      setModalMessage(isRepair ? t("app", "repairSuccessMsg") : t("app", "installSuccessMsg").replace("{launchOptions}", steamLaunchOptionsForRoute(route)));
      setModalType("success");
      setShowModal(true);
    } catch (err) {
      setLogs((prev) => prev + t("app", "criticalError") + localizeInstallationMessage(String(err), language));
      
      let shortErr = String(err);
      if (shortErr.includes("Log completo:")) {
          shortErr = shortErr.split("Log completo:")[0].trim();
      } else {
          const lines = shortErr.split("\n");
          shortErr = lines.slice(0, 2).join("\n") + (lines.length > 2 ? "\n..." : "");
      }

      setModalTitle(t("app", "installFailTitle"));
      const missingModel = isMissingModel(err);
      setModelRecovery(missingModel);
      setModalMessage(missingModel ? t("installation", "missingModel") : t("app", "installFailMsg") + localizeInstallationMessage(shortErr, language));
      setModalType("error");
      setShowModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const [showUninstallPrompt, setShowUninstallPrompt] = useState(false);
  const [showConfirmGameUninstall, setShowConfirmGameUninstall] = useState<string | null>(null);

  const handleUninstallClick = () => {
    setShowUninstallPrompt(true);
  };

  const proceedUninstallForPath = async (path: string) => {
    setModelRecovery(false);
    setLoading(true);
    setLoadingMessage(t("app", "uninstallingMsg"));
    setLogs(t("app", "uninstallStarted"));
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const response = await runInstallation({
        gameDir: path,
        route: "remove",
        bitness,
        gpuArch,
        dllPath: null,
        binPath: null,
      });
      setLogs((prev) => prev + "\n" + localizeInstallationMessage(response, language));

      setModalTitle(t("app", "uninstallSuccessTitle"));
      setModalMessage(t("app", "uninstallSuccessMsg") + path);
      setModalType("success");
      setShowModal(true);
    } catch (err) {
      setLogs((prev) => prev + t("app", "criticalError") + localizeInstallationMessage(String(err), language));
      
      let shortErr = String(err);
      if (shortErr.includes("Log completo:")) {
          shortErr = shortErr.split("Log completo:")[0].trim();
      } else {
          const lines = shortErr.split("\n");
          shortErr = lines.slice(0, 2).join("\n") + (lines.length > 2 ? "\n..." : "");
      }

      setModalTitle(t("app", "uninstallFailTitle"));
      setModalMessage(`${t("app", "uninstallFailMsg")} ${path}${t("app", "uninstallFailLog")}${localizeInstallationMessage(shortErr, language)}`);
      setModalType("error");
      setShowModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage("");
      // Refresh status if selected game was uninstalled
      if (selectedGame && selectedGame.path === path) {
        await refreshInstallationDetails(path);
      }
    }
  };

  const proceedUninstall = async () => {
    setShowUninstallPrompt(false);
    const path = await openDirectoryPicker("Selecione a pasta do jogo");
    if (!path) return; // User cancelled
    await proceedUninstallForPath(path);
  };

  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [isCollapsingGame, setIsCollapsingGame] = useState(false);
  const [ambientCoverUrl, setAmbientCoverUrl] = useState<string>();
  useEffect(() => {
    // Finish moving the library before repainting the full-window blurred background.
    if (!isCollapsingGame) setAmbientCoverUrl(selectedGame?.cover_url);
  }, [selectedGame?.cover_url, isCollapsingGame]);
  const collapseGameDetails = () => {
    setIsCollapsingGame(true);
    setCoverContextMenu(null);
    setSelectedGame(null);
    setGameDir("");
  };
  const [selectedGameCoverError, setSelectedGameCoverError] = useState(false);
  useEffect(() => {
    const coverChanged = (event: Event) => {
      const game = (event as CustomEvent<GameInfo>).detail;
      setSelectedGame(previous => previous?.path === game.path ? { ...previous, cover_url: game.cover_url, automatic_cover_url: game.automatic_cover_url } : previous);
      setSelectedGameCoverError(false);
    };
    const coverError = () => {
      setModalTitle(t("gameGrid", "coverErrorTitle"));
      setModalMessage(t("gameGrid", "coverError"));
      setModalType("error"); setModelRecovery(false); setLogs(""); setShowModal(true);
    };
    window.addEventListener("gameCoverChanged", coverChanged);
    window.addEventListener("gameCoverError", coverError);
    return () => { window.removeEventListener("gameCoverChanged", coverChanged); window.removeEventListener("gameCoverError", coverError); };
  }, [language]);
  const [releaseDate, setReleaseDate] = useState<string>("Desconhecido");
  const [gameInfoRevision, setGameInfoRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setGameInfoRevision(revision => revision + 1);
    window.addEventListener("gameInfoCacheCleared", refresh);
    return () => window.removeEventListener("gameInfoCacheCleared", refresh);
  }, []);
  const analysis = useGameAnalysis(selectedGame?.path, selectedGame?.name, selectedGame?.app_id || undefined, gameInfoRevision);
  const [installStatus, setInstallStatus] = useState<string>("Verificando...");
  const [installedDll, setInstalledDll] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const request = ++installationRequest.current;
    if (selectedGame) {
      setSelectedGameCoverError(false);
      if (selectedGame.app_id) {
        setReleaseDate("Detectando...");
        invoke<string>("fetch_steam_release_date", { appId: selectedGame.app_id })
          .then((date: string) => { if (active) setReleaseDate(date); })
          .catch(() => { if (active) setReleaseDate("Desconhecido"); });
      } else {
        setReleaseDate("Desconhecido");
      }

      setInstallStatus("Verificando...");
      setInstalledDll(null);
      invoke<{ status: string; installed_dll: string | null }>("get_game_installation_details", { gameDir: selectedGame.path })
        .then(result => {
          if (active && request === installationRequest.current) { setInstallStatus(result.status); setInstalledDll(result.installed_dll); }
        })
        .catch(() => { if (active && request === installationRequest.current) { setInstallStatus("Erro"); setInstalledDll(null); } });

    } else {
      setReleaseDate("Desconhecido");
      setInstallStatus("Nenhum");
      setInstalledDll(null);
    }
    return () => { active = false; };
  }, [selectedGame?.path, selectedGame?.app_id, gameInfoRevision]);

  const handleSelectGame = (game: GameInfo) => {
    if (game.path === selectedGame?.path) {
      collapseGameDetails();
    } else {
      setIsCollapsingGame(false);
      setPlayGameEntrance(true);
      setGameDir(game.path);
      setSelectedGame(game);
    }
  };

  const handleCoverMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    if (performanceMode) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    const glare = card.querySelector('.glare') as HTMLDivElement;
    if (glare) {
      glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.3) 0%, transparent 60%)`;
      glare.style.opacity = "1";
    }
  };

  const handleCoverMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    const glare = card.querySelector('.glare') as HTMLDivElement;
    if (glare) {
      glare.style.opacity = "0";
    }
  };

  const handleSaveCustomPath = async () => {
    if (!selectedGame) return;
    try {
      await invoke("save_custom_game_path", { gameName: selectedGame.name, newPath: editPathValue });
      // Update the cached library without scanning the launchers again.
      window.dispatchEvent(new CustomEvent("refreshGames", { detail: { oldPath: selectedGame.path, newPath: editPathValue } }));
      setSelectedGame(prev => prev ? { ...prev, path: editPathValue } : null);
      setGameDir(editPathValue);
      setIsEditingPath(false);
      
    } catch (e) {
      console.error("Failed to save custom path:", e);
    }
  };

  const hasOpenDialog = showSetupWizard || showSettingsModal || showCreditsModal || showInstructionsModal || showUpdaterModal || showModal || showUninstallPrompt || !!showConfirmGameUninstall || loading;

  useEffect(() => {
    if (hasOpenDialog) {
      setShowSettings(false);
      setShowLangDropdown(false);
      setCoverContextMenu(null);
    }
  }, [hasOpenDialog]);

  return (
    <EffectsContext.Provider value={performanceMode}>
      {!performanceMode && <AmbientBackground coverUrl={ambientCoverUrl} />}
      <div className="app-wrapper" style={{ animation: effectsHaveChanged ? "none" : undefined }}>
        <TitleBar 
          onShowCredits={() => setShowCreditsModal(true)} 
          disabled={hasOpenDialog}
          settingsMenu={
            <div style={{ position: "relative" }} ref={settingsRef}>
              <button 
                data-tauri-drag-region="false"
                className="btn-titlebar" 
                style={{ padding: "0.3rem 0.5rem", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", background: showSettings ? "rgba(255,255,255,0.15)" : "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }} 
                disabled={hasOpenDialog}
                onClick={() => { if (!hasOpenDialog) setShowSettings(!showSettings); }}
                title={t("settings", "title")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>
              
              {showSettings && (
                <div className="dialog-popover" style={{ position: "absolute", top: "100%", right: 0, marginTop: "0.5rem", background: "rgba(15, 10, 28, 0.6)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)", width: "220px", zIndex: 100, overflow: "hidden", display: "flex", flexDirection: "column", textAlign: "left" }}>
                  <div style={{ padding: "0.8rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>{t("settings", "title")}</span>
                  </div>
              
                  <div style={{ padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.8rem", width: "100%", borderRadius: "6px", background: "transparent", border: "none" }}
                      onClick={() => { setShowSettingsModal(true); setShowSettings(false); }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        <span>{t("settings", "preferences")}</span>
                      </div>
                    </button>


                    <div className="effects-preference">
                      <span className="effects-preference-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>
                        {t("settings", "language")}
                      </span>
                      <div className="effects-menu-anchor">
                        <button type="button" className="effects-menu-trigger" aria-label={t("settings", "language")}
                          aria-haspopup="menu" aria-expanded={showLangDropdown}
                          onClick={e => { e.stopPropagation(); setShowLangDropdown(!showLangDropdown); setShowEffectsDropdown(false); }}>
                          {language === "pt" ? "BR" : "EN"}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        {showLangDropdown && <div className="effects-menu" role="menu">
                          {(["pt", "en"] as const).map(lang => <button key={lang} type="button" role="menuitemradio" aria-checked={language === lang}
                            onClick={() => { setLanguage(lang); setShowLangDropdown(false); setShowSettings(false); }}>
                            {lang === "pt" ? "BR" : "EN"}
                          </button>)}
                        </div>}
                      </div>
                    </div>

                    <div className="effects-preference">
                      <span className="effects-preference-label"><MenuIcon name="bolt" /> {t("settings", "effects")}</span>
                      <div className="effects-menu-anchor">
                        <button type="button" className="effects-menu-trigger" aria-label={t("settings", "effects")}
                          aria-haspopup="menu" aria-expanded={showEffectsDropdown} aria-controls="interface-effects-menu"
                          onClick={() => { setShowEffectsDropdown(!showEffectsDropdown); setShowLangDropdown(false); }}
                          onKeyDown={e => { if (e.key === "Escape") setShowEffectsDropdown(false); }}>
                          {t("settings", performanceMode ? "performance" : "elegant")}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        {showEffectsDropdown && <div id="interface-effects-menu" className="effects-menu" role="menu"
                          onKeyDown={e => { if (e.key === "Escape") setShowEffectsDropdown(false); }}>
                          <button type="button" role="menuitemradio" aria-checked={!performanceMode} onClick={() => { setPerformanceMode(false); setShowEffectsDropdown(false); }}>{t("settings", "elegant")}</button>
                          <button type="button" role="menuitemradio" aria-checked={performanceMode} onClick={() => { setPerformanceMode(true); setShowEffectsDropdown(false); }}>{t("settings", "performance")}</button>
                        </div>}
                      </div>
                    </div>
                    <div style={{ padding: "0.5rem 0.8rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                        <span>{t("settings", "scale")}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                        <button className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", borderRadius: "4px" }} onClick={() => setUiScale(Math.max(0.6, uiScale - 0.1))}>-</button>
                        <span style={{ fontSize: "0.9rem", color: "#ffb3b3" }}>{Math.round(uiScale * 100)}%</span>
                        <button className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", borderRadius: "4px" }} onClick={() => setUiScale(Math.min(2.0, uiScale + 0.1))}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          } 
        />
        <div className="container" style={{ padding: '1rem', paddingTop: '0.5rem', height: 'calc(100vh - 50px)', overflow: 'auto' }}>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 0, minHeight: 0 }}>
        
        {/* Top Section: Selected Game Details & Settings */}
        <AnimatePresence onExitComplete={() => setIsCollapsingGame(false)}>
        {selectedGame && (
          <motion.section key="game-details" className="selected-game-shell"
            initial={false} animate={{ height: "auto", overflow: "visible" }} exit={{ height: 0, overflow: "hidden" }}
            transition={{ duration: performanceMode ? 0 : 0.42, ease: [0.4, 0, 0.2, 1] }}>
          <motion.div style={{ paddingBottom: 32 }} exit={{ y: performanceMode ? 0 : 180, opacity: 0 }} transition={{ duration: performanceMode ? 0 : 0.42, ease: [0.4, 0, 0.2, 1] }}>
          <div className="selected-game-menu" style={{ animation: performanceMode || !playGameEntrance ? "none" : "slide-up 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards" }}>
            
            {/* Left: Cover & Info */}
            <div className="game-summary">
              <div className="game-cover-column">
                <motion.div 
                  key={`${selectedGame.path}-${performanceMode ? "performance" : "elegant"}`}
                  className="selected-cover"
                  layout={performanceMode ? false : "preserve-aspect"}
                  layoutId={performanceMode ? undefined : `cover-${selectedGame.path}`}
                  onMouseMove={handleCoverMouseMove}
                  onMouseLeave={handleCoverMouseLeave}
                  style={{ 
                    position: "relative",
                    borderRadius: "12px", 
                    overflow: "hidden",
                    transition: "box-shadow 0.1s ease-out",
                    boxShadow: "0 0 20px rgba(237, 28, 36, 0.6)",
                    border: "2px solid rgba(237, 28, 36, 0.8)",
                    transformStyle: "preserve-3d",
                    willChange: "transform",
                    cursor: "pointer",
                    height: "max-content",
                    display: "inline-block"
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setCoverContextMenu({ x: e.clientX, y: e.clientY }); }}
                >
                  <div className="glare" style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    pointerEvents: "none", opacity: 0, transition: "opacity 0.2s ease-out", zIndex: 10
                  }} />
                  {selectedGame.cover_url && !selectedGameCoverError ? (
                    <img 
                      src={selectedGame.cover_url} 
                      alt={selectedGame.name}
                      decoding="async"
                      onError={() => setSelectedGameCoverError(true)}
                      style={{ 
                        width: "180px", 
                        objectFit: "cover",
                        aspectRatio: "2/3",
                        display: "block"
                      }} 
                    />
                  ) : (
                    <div style={{ 
                        width: "180px", aspectRatio: "2/3", 
                        background: "linear-gradient(135deg, #1e3a8a, #312e81)", 
                        position: "relative",
                        textAlign: "center"
                      }}>
                      <span style={{ position: "absolute", top: "1.5rem", left: "1rem", right: "1rem", fontWeight: "bold", fontSize: "1.1rem", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>{selectedGame.name}</span>
                      <img src="/icon.png" alt="Icon" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "60px", height: "60px", opacity: 0.5 }} />
                    </div>
                  )}
                </motion.div>
                <button 
                  onClick={collapseGameDetails}
                  className="btn game-back-button"
                  style={{ width: "100%", marginTop: "0.5rem", padding: "0.4rem 0.6rem", fontSize: "0.85rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", cursor: "pointer", transition: "all 0.2s" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  {t("gameInfo", "backToGrid")}
                </button>
              </div>

              {/* Left Panel: Title & Stacked Buttons */}
              <div className="game-action-column">
                <h3 className="selected-game-title">{selectedGame.name}</h3>
                
                <div className="game-action-stack">
                  {selectedGame.launcher === "Steam" && (
                    <button 
                      className="btn btn-play game-play-button" 
                      onClick={() => {
                        invoke("launch_game", { 
                          path: selectedGame.path, 
                          appId: selectedGame.app_id || null, 
                          launcher: selectedGame.launcher 
                        }).catch((e: any) => console.error("Error launching game:", e));
                      }}
                      style={{ 
                        background: "#10b981", color: "white", border: "none", 
                        padding: "0.6rem", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                        boxShadow: "0 0 10px rgba(16, 185, 129, 0.4)", transition: "all 0.2s ease", width: "100%"
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> {t("gameInfo", "startGame")}
                    </button>
                  )}
                  
                  <div style={{ width: "100%" }}>
                    <InstallAction onInstall={handleInstall} onUninstall={handleUninstallClick} loading={loading} installStatus={installStatus} />
                  </div>
                  
                  {installStatus !== "Não Instalado" && installStatus !== "Nenhum" && installStatus !== "Verificando..." && (
                    <button 
                      className="btn btn-secondary game-uninstall-button" 
                      onClick={() => setShowConfirmGameUninstall(selectedGame.path)}
                      style={{ 
                        background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)", 
                        padding: "0.5rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%"
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
                      {t("gameInfo", "uninstall")}
                    </button>
                  )}
                  


                  <a className="game-folder-link"
                    onClick={() => {
                      invoke("open_folder", { path: selectedGame.path }).catch((e: any) => console.error("Error opening folder:", e));
                    }}
                    style={{ 
                      color: "#94a3b8", fontSize: "0.9rem", textAlign: "center", cursor: "pointer", textDecoration: "underline",
                      marginTop: "0.25rem", display: "block"
                    }}
                  >
                    {t("gameInfo", "openFolder")}
                  </a>
                  
                  {selectedGame.launcher === "Manual" && (
                    <a className="game-remove-link"
                      onClick={() => {
                        const saved = localStorage.getItem("custom_folders");
                        if (saved) {
                          const folders = JSON.parse(saved);
                          const newFolders = folders.filter((f: string) => f !== selectedGame.path);
                          localStorage.setItem("custom_folders", JSON.stringify(newFolders));
                          window.dispatchEvent(new Event("refreshGames"));
                          setSelectedGame(null);
                          setGameDir("");
                        }
                      }}
                      style={{ 
                        color: "#ef4444", fontSize: "0.9rem", textAlign: "center", cursor: "pointer", textDecoration: "underline",
                        marginTop: "0.5rem", display: "block"
                      }}
                    >
                      {t("gameInfo", "removeGame")}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Game Info & Selectors */}
            <div className="game-detail-panels">
              
              {/* Game Info Column */}
              <div className="game-info-panel menu-glass-panel">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <MenuIcon name="document" />
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: "0.95rem" }}>{t("gameInfo", "title")}</span>
                </div>
                <div className="game-info-fields">
                  <span className="game-info-label"><MenuIcon name="folder" />{t("gameInfo", "directory")}</span>
                  <div className="game-directory-value">
                    {isEditingPath ? (
                      <>
                        <input 
                          type="text" 
                          value={editPathValue} 
                          onChange={e => setEditPathValue(e.target.value)} 
                          style={{ flex: 1, padding: "0.2rem 0.4rem", background: "rgba(0,0,0,0.5)", color: "#fff", border: "1px solid #475569", borderRadius: "4px", fontSize: "0.8rem", width: "100%" }}
                        />
                        <button onClick={handleSaveCustomPath} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#10b981", padding: 0 }} title={t("settings", "save")}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        <button onClick={() => setIsEditingPath(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 0 }} title={t("settings", "cancel")}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="game-path-text" title={selectedGame.path}>{selectedGame.path}</span>
                        <button 
                          onClick={() => {
                            setEditPathValue(selectedGame.path);
                            setIsEditingPath(true);
                          }} 
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, opacity: 0.7 }} 
                          title={t("gameInfo", "editDirectory")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                      </>
                    )}
                  </div>
                  <span className="game-info-label"><MenuIcon name="calendar" />{t("gameInfo", "release")}</span><span className="info-value-pill" style={{ color: "#e2e8f0" }}>{releaseDate === "Desconhecido" ? t("gameInfo", "unknown") : (releaseDate === "Detectando..." ? "..." : releaseDate)}</span>
                  <span className="game-info-label"><MenuIcon name="platform" />{t("gameInfo", "platform")}</span><span className="info-value-pill info-platform" style={{ color: "#e2e8f0" }}>{localizeAnalysisValue(analysis.platform)}</span>
                  <span className="game-info-label"><MenuIcon name="chip" />{t("gameInfo", "architecture")}</span><span className="info-value-pill info-architecture" style={{ color: "#60a5fa", background: "rgba(96,165,250,0.1)", padding: "2px 6px", borderRadius: "4px", justifySelf: "start" }}>{localizeAnalysisValue(analysis.architecture)}</span>
                  <span className="game-info-label"><MenuIcon name="graphics" />{t("gameInfo", "graphicsApi")}</span>
                  <span className="info-value-pill info-api" style={{ color: "#c084fc", background: "rgba(192,132,252,0.1)", padding: "2px 6px", borderRadius: "4px", justifySelf: "start" }}>
                    {localizeAnalysisValue(analysis.graphics_api)}
                  </span>
                  <span className="game-info-label"><MenuIcon name="puzzle" />{t("gameInfo", "modInstalled")}</span>
                  <span className="info-value-pill info-mod-status" style={{ color: installStatus === "Nenhum" || installStatus === "Não Instalado" ? "#ef4444" : "#10b981", background: installStatus === "Nenhum" || installStatus === "Não Instalado" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: "4px", justifySelf: "start", fontWeight: "bold" }}>
                    {installStatus === "Verificando..." ? t("gameInfo", "verifying") : (installStatus === "Nenhum" || installStatus === "Não Instalado" ? t("gameInfo", "no") : `${t("gameInfo", "yes")} (${installStatus.replace(/^Instalado\s*\((.*)\)$/, "$1")})`)}
                  </span>
                  
                  {installStatus !== "Não Instalado" && installStatus !== "Nenhum" && installStatus !== "Verificando..." && (
                    <>
                      <span className="game-info-label"><MenuIcon name="document" />{t("gameInfo", "injectedDll")}</span>
                      <span className="info-value-pill info-architecture" style={{ color: "#60a5fa", fontFamily: "monospace", padding: "2px 6px", background: "rgba(96, 165, 250, 0.1)", borderRadius: "4px", justifySelf: "start" }}>
                        {installedDll || t("gameInfo", "unknown")}
                      </span>
                      
                      <span className="game-info-label"><MenuIcon name="logs" />{t("gameInfo", "gameLogs")}</span>
                      <a 
                        onClick={() => {
                          invoke("collect_and_open_logs", { gameName: selectedGame.name, gameDir: selectedGame.path }).catch((e: any) => console.error("Error opening logs:", e));
                        }}
                        style={{ color: "#fbbf24", textDecoration: "underline", cursor: "pointer", justifySelf: "start" }}
                      >
                        {t("gameInfo", "openLogs")}
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Mod Configuration Column */}
              <div className="mod-config-panel menu-glass-panel">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <MenuIcon name="settings" />
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: "0.95rem" }}>{t("gameInfo", "modConfig")}</span>
                </div>
                {/* BitnessSelector */}
                <div className="mod-control-group mod-bitness-group" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MenuIcon name="chip" />
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{t("bitness", "title")}</span>
                  </div>
                  <BitnessSelector bitness={bitness} setBitness={setBitness} gpuArch={gpuArch} />
                </div>

                {/* RouteSelector */}
                <div className="mod-control-group mod-route-group" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MenuIcon name="cube" />
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{t("routeSelector", "title")}</span>
                  </div>
                  <RouteSelector route={route} setRoute={changeInstallRoute} bitness={bitness} />
                </div>

                {/* ShortcutKeySelector */}
                <div className="mod-control-group mod-shortcut-group" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem", opacity: (installStatus === "Não Instalado" || installStatus === "Nenhum" || installStatus === "Verificando...") ? 0.4 : 1, pointerEvents: (installStatus === "Não Instalado" || installStatus === "Nenhum" || installStatus === "Verificando...") ? "none" : "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MenuIcon name="keyboard" />
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{t("gameInfo", "menuKey")}</span>
                  </div>
                  <ShortcutKeySelector 
                    route={route}
                    shortcutKey={appConfig?.shortcut_key || defaultShortcutForRoute(route)}
                    setShortcutKey={(val) => {
                      if (appConfig) {
                        const newConfig = { ...appConfig, shortcut_key: val };
                        setAppConfig(newConfig);
                        invoke("save_app_config", { config: newConfig }).catch(err => console.error("Failed to save config:", err));
                        if (selectedGame && (installStatus !== "Não Instalado" && installStatus !== "Nenhum")) {
                          invoke("update_shortcut_key_in_game", { gameDir: selectedGame.path, shortcutKey: val })
                            .catch(err => console.error("Failed to update shortcut in game:", err));
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          </motion.div>
          <div className="selected-game-divider" />
          </motion.section>
        )}
        </AnimatePresence>

        {/* Bottom Section: Always visible Game Grid */}
        <div className={`game-library-section ${isCollapsingGame ? "game-library-section--collapsing" : ""}`} style={{ flex: 1, minHeight: "300px", display: "flex", flexDirection: "column" }}>
          <GameGrid onSelectGame={handleSelectGame} selectedGamePath={selectedGame?.path} />
        </div>
      </div>

      <div style={{ textAlign: "right", marginTop: "1rem", fontSize: "0.75rem", opacity: 0.6, fontFamily: "monospace", padding: "0 1rem" }}>
        {APP_BUILD_LABEL}
      </div>
      </div>
    </div>

    {showConfirmGameUninstall && (
      <ConfirmModal 
        title={t("confirm", "attention")}
        message={t("confirm", "uninstallGame")}
        isDanger={true}
        confirmText={t("confirm", "uninstallBtn")}
        cancelText={t("confirm", "cancel")}
        onCancel={() => setShowConfirmGameUninstall(null)}
        onConfirm={() => {
          const path = showConfirmGameUninstall;
          setShowConfirmGameUninstall(null);
          proceedUninstallForPath(path);
        }}
      />
    )}

    {showUninstallPrompt && (
      <UninstallModal 
        onCancel={() => setShowUninstallPrompt(false)} 
        onPickDirectory={proceedUninstall} 
      />
    )}

    {showUpdaterModal && (
      <BackendUpdaterModal 
        gpuArch={gpuArch} 
        onClose={() => setShowUpdaterModal(false)} 
      />
    )}

    {showInstructionsModal && (
      <InstructionsModal onClose={() => setShowInstructionsModal(false)} />
    )}

    {showCreditsModal && (
      <CreditsModal onClose={() => setShowCreditsModal(false)} />
    )}

    {showSetupWizard && (
      <SetupWizard 
        allowCancel={appConfig !== null}
        onCancel={() => setShowSetupWizard(false)}
        onComplete={(config) => {
          setAppConfig(config);
          setShowSetupWizard(false);
        }} 
      />
    )}

    {showSettingsModal && (
      <SettingsModal 
        onClose={() => setShowSettingsModal(false)}
        onConfigUpdated={(config) => {
          setAppConfig(config);
          if (!config) setShowSetupWizard(true);
        }}
        onOpenWizard={() => setShowSetupWizard(true)}
      />
    )}

    {showModal && (
      <ResultModal 
        title={modalTitle} 
        message={modalMessage} 
        type={modalType} 
        logs={logs}
        onOpenSetup={modalType === "error" && modelRecovery ? () => { setShowModal(false); setModelRecovery(false); setShowSetupWizard(true); } : undefined}
        onClose={() => setShowModal(false)} 
      />
    )}

    {loading && loadingMessage && (
      <LoadingModal message={loadingMessage} />
    )}
    
    {coverContextMenu && selectedGame && (
      <div ref={coverContextMenuRef} style={{
        position: "fixed", top: coverContextMenu.y, left: coverContextMenu.x, zIndex: 1000,
        background: "#1e1e2f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)", overflow: "hidden", minWidth: "180px",
        display: "flex", flexDirection: "column"
      }}>
        {selectedGame.launcher === "Manual" && (
          <button
            onClick={() => {
              const customFolders = JSON.parse(localStorage.getItem("custom_folders") || "[]");
              const newFolders = customFolders.filter((f: string) => f !== selectedGame.path);
              localStorage.setItem("custom_folders", JSON.stringify(newFolders));
              window.dispatchEvent(new Event("refreshGames"));
              setSelectedGame(null);
              setGameDir("");
              setCoverContextMenu(null);
            }}
            style={{
              background: "transparent", border: "none", color: "#ef4444", padding: "0.5rem 1rem",
              textAlign: "left", cursor: "pointer", fontSize: "0.9rem"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
          >
            {t("gameGrid", "removeGame")}
          </button>
        )}
        
        <button
          onClick={async () => {
            const game = selectedGame;
            setCoverContextMenu(null);
            try { await changeLocalCover(game); } catch (error) { reportCoverError(error); }
          }}
          style={{
            background: "transparent", border: "none", color: "#e2e8f0", padding: "0.5rem 1rem",
            textAlign: "left", cursor: "pointer", fontSize: "0.9rem"
          }}
          onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
        >
          {t("gameGrid", "changeCover")}
        </button>
        
        <button onClick={async () => {
          const game = selectedGame;
          setCoverContextMenu(null);
          try { await resetGameCover(game); } catch (error) { reportCoverError(error); }
        }} style={{ background: "transparent", border: "none", color: "#e2e8f0", padding: "0.5rem 1rem", textAlign: "left", cursor: "pointer", fontSize: "0.9rem" }}>
          {t("gameGrid", "resetCover")}
        </button>

        <button
          onClick={() => {
            window.dispatchEvent(new Event("rescanGames"));
            setCoverContextMenu(null);
          }}
          style={{
            background: "transparent", border: "none", color: "#60a5fa", padding: "0.5rem 1rem",
            textAlign: "left", cursor: "pointer", fontSize: "0.9rem", borderTop: "1px solid rgba(255,255,255,0.1)"
          }}
          onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
        >
          {t("gameGrid", "rescan")}
        </button>
      </div>
    )}
    </EffectsContext.Provider>
  );
}

export default App;
