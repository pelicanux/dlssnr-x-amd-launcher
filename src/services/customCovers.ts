import { STEAMGRIDDB_API_KEY } from "./coverConfig";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { GameInfo } from "../components/GameGrid";
import { openFilePicker } from "./tauriService";

export function readCustomCovers(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem("custom_covers") || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}

export function hasCustomCover(path: string) { return typeof readCustomCovers()[path] === "string"; }

function publish(game: GameInfo) {
  window.dispatchEvent(new CustomEvent("gameCoverChanged", { detail: game }));
}

export async function changeLocalCover(game: GameInfo) {
  const file = await openFilePicker("Images", ["png", "jpg", "jpeg", "webp"]);
  if (!file) return;
  const savedPath = await invoke<string>("import_game_cover", { source: file });
  const url = convertFileSrc(savedPath);
  // Only replace a working cover after the imported image can actually be displayed.
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load the selected image"));
    image.src = url;
  });
  localStorage.setItem("custom_covers", JSON.stringify({ ...readCustomCovers(), [game.path]: url }));
  publish({ ...game, automatic_cover_url: game.automatic_cover_url !== undefined ? game.automatic_cover_url : game.cover_url ?? null, cover_url: url });
}

export async function resetGameCover(game: GameInfo) {
  let url = game.automatic_cover_url;
  if (!url || url.startsWith("asset:")) {
    url = game.app_id ? `https://steamcdn-a.akamaihd.net/steam/apps/${game.app_id}/library_600x900.jpg`
      : await invoke<string | null>("fetch_steamgriddb_cover_command", { name: game.name, apiKey: STEAMGRIDDB_API_KEY });
  }
  const covers = readCustomCovers();
  delete covers[game.path];
  localStorage.setItem("custom_covers", JSON.stringify(covers));
  publish({ ...game, automatic_cover_url: url ?? null, cover_url: url ?? undefined });
}

export function reportCoverError(error: unknown) {
  window.dispatchEvent(new CustomEvent("gameCoverError", { detail: String(error) }));
}
