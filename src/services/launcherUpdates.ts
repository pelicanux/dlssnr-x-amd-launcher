import { invoke } from "@tauri-apps/api/core";

export type LauncherUpdateInfo = {
  current: string;
  latest: string | null;
  available: boolean;
  notes: string;
  packages: { id: number; name: string; size: number }[];
  preferred: number | null;
  appimage: boolean;
  format: string;
};
export type LauncherUpdateStatus = "checking" | "available" | "current" | "error";

// Reuse the startup request across React effect remounts and the update dialog.
let startupCheck: Promise<LauncherUpdateInfo> | undefined;
export function checkLauncherUpdateOnStartup() {
  return startupCheck ??= checkLauncherUpdate();
}

export async function checkLauncherUpdate() {
    // Keep feedback visible even when GitHub responds before the first frames.
    const feedback = new Promise<void>(resolve => setTimeout(resolve, 3000));
    try { return await invoke<LauncherUpdateInfo>("check_launcher_update"); }
    finally { await feedback; }
}

export type LauncherDownloadProgress = {
  percent: number;
  bytesPerSecond: number;
  received: number;
  total: number;
};
export function formatDownloadSpeed(bytesPerSecond: number, language: "pt" | "en") {
  const speed = Number.isFinite(bytesPerSecond) ? Math.max(0, bytesPerSecond) : 0;
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  const unit = Math.min(3, Math.floor(Math.log10(Math.max(1, speed)) / 3));
  return `${(speed / 1000 ** unit).toLocaleString(language === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
}
