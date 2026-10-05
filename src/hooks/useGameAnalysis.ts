import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GameAnalysisResult {
  platform: string;
  architecture: string;
  graphics_api: string;
  upscalers?: string[];
}

const emptyAnalysis: GameAnalysisResult = {
  platform: "Verificando...",
  architecture: "Verificando...",
  graphics_api: "Verificando...",
};

export function useGameAnalysis(path?: string, name?: string, appId?: string, revision = 0) {
  const identity = JSON.stringify([path, name, appId, revision]);
  const [state, setState] = useState({ identity, analysis: emptyAnalysis });
  const setAnalysis = (analysis: GameAnalysisResult) => setState({ identity, analysis });

  useEffect(() => {
    setAnalysis(emptyAnalysis);
    if (!path) return;
    let active = true;

    invoke<GameAnalysisResult>("analyze_game", { path, name: name || "", appId: appId || null })
      .then(result => { if (active) setAnalysis(result); })
      .catch(error => {
        console.error("Could not fetch game analysis:", error);
        if (active) setAnalysis({ platform: "Não detectado", architecture: "Não detectada", graphics_api: "Não detectada" });
      });

    return () => {
      active = false;
    };
  }, [path, name, appId, revision]);

  return state.identity === identity ? state.analysis : emptyAnalysis;
}
