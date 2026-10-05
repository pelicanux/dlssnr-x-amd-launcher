import { invoke } from "@tauri-apps/api/core";

export type LauncherUpdateInfo = {
  current: string;
  latest: string | null;
  available: boolean;
  notes: string;
  packages: { id: number; name: string; size: number }[];
  preferred: number | null;
  appimage: boolean;
};
export type LauncherUpdateStatus = "checking" | "available" | "current" | "error";

// Reuse the startup request across React effect remounts and the update dialog.
let startupCheck: Promise<LauncherUpdateInfo> | undefined;
export function checkLauncherUpdateOnStartup() {
  return startupCheck ??= invoke<LauncherUpdateInfo>("check_launcher_update");
}
