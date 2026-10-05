import { invoke } from "@tauri-apps/api/core";
import { InstallerPayload } from "../types/installer";

/**
 * Invokes the Rust backend command to perform the installation.
 * @param payload The installation options (game directory, model source, route).
 * @returns The installation log/output string on success.
 * @throws An error message if the installation fails.
 */
export const runInstallation = async (payload: InstallerPayload): Promise<string> => {
  return await invoke<string>("install_mod", {
    gameDir: payload.gameDir,
    route: payload.route,
    bitness: payload.bitness,
    gpuArch: payload.gpuArch,
    dllPath: payload.dllPath,
    binPath: payload.binPath,
    shortcutKey: payload.shortcutKey || "Insert",
    neuralStartup: payload.neuralStartup ?? null,
  });
};

/**
 * Checks if there is a cached dlssnr.bin file for the given bitness
 * @param bitness "32" or "64"
 * @returns The absolute path to the cached bin file, or null if not found
 */
export const checkCachedBin = async (bitness: "32" | "64", gpuArch: "rdna3" | "rdna4"): Promise<string | null> => {
  return await invoke<string | null>("check_cached_bin", {
    bitness,
    gpuArch,
  });
};
