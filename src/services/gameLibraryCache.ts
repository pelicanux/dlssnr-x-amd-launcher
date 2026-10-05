import { convertFileSrc } from "@tauri-apps/api/core";
import { readCustomCovers } from "./customCovers";
import type { GameInfo } from "../components/GameGrid";

const CACHE_KEY = "game_library_cache_v1";

export function applyCustomCovers(games: GameInfo[]): GameInfo[] {
  const covers = readCustomCovers();
  return games.map(game => {
    const custom = covers[game.path];
    // Save the automatic artwork separately, including games with no automatic cover.
    let automatic = game.automatic_cover_url !== undefined ? game.automatic_cover_url
      : game.cover_url?.startsWith("asset:") ? null : game.cover_url ?? null;
    if (automatic?.startsWith("file://")) {
      try { automatic = convertFileSrc(decodeURIComponent(new URL(automatic).pathname)); }
      catch { automatic = null; }
    }
    return { ...game, automatic_cover_url: automatic, cover_url: typeof custom === "string" ? custom : automatic ?? undefined };
  });
}

export function readGameLibrary(): GameInfo[] | null {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved === null) return null;
    const cache = JSON.parse(saved);
    if (cache.version !== 1 || !Array.isArray(cache.games) || !cache.games.every((game: GameInfo) =>
      game && typeof game.name === "string" && typeof game.path === "string" && typeof game.launcher === "string" &&
      (game.cover_url == null || typeof game.cover_url === "string") && (game.app_id == null || typeof game.app_id === "string")
    )) return null;
    // An empty successful scan is also a valid library.
    return applyCustomCovers(cache.games);
  } catch { return null; }
}

export function saveGameLibrary(games: GameInfo[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, games })); }
  catch (error) { console.error("Failed to save game library", error); }
}
