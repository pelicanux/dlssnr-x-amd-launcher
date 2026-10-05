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
  return startupCheck ??= (async () => {
    // Keep startup feedback visible even when GitHub responds before the first frames.
    const feedback = new Promise<void>(resolve => setTimeout(resolve, 3000));
    try { return await invoke<LauncherUpdateInfo>("check_launcher_update"); }
    finally { await feedback; }
  })();
}
