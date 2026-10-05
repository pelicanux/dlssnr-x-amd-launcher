import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createLatestWriteQueue } from "../services/latestWriteQueue";

type Feedback = "" | "nextLaunch";
const KEY = "neural_startup_preferences";
function readPreferences(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function useNeuralStartup(path: string | undefined, installed: boolean) {
  const identity = JSON.stringify([path, installed]);
  const initial = path ? readPreferences()[path] ?? true : true;
  const queueIdentity = useRef("");
  const queue = useRef<ReturnType<typeof createLatestWriteQueue<boolean, Feedback>> | null>(null);
  const [state, setState] = useState({ identity, enabled: initial, busy: installed, initializing: installed, error: "", feedback: "" as Feedback });
  useEffect(() => {
    let active = true;
    let confirmed = initial;
    setState({ identity, enabled: initial, busy: installed, initializing: installed, error: "", feedback: "" as Feedback });
    const writer = createLatestWriteQueue<boolean, Feedback>(async value => {
      const feedback: Feedback = "nextLaunch";
      if (path && installed) {
        await invoke<void>("set_neural_startup", { gameDir: path, enabled: value });
      }
      confirmed = value;
      if (path) localStorage.setItem(KEY, JSON.stringify({ ...readPreferences(), [path]: value }));
      return feedback;
    }, (value, feedback, error) => {
      if (active) setState({ identity, enabled: error === undefined ? value : confirmed, busy: false, initializing: false, error: error === undefined ? "" : String(error), feedback: error === undefined ? feedback ?? "" : "" });
    });
    queue.current = writer;
    queueIdentity.current = identity;
    if (path && installed) {
      invoke<boolean>("get_neural_startup", { gameDir: path })
        .then(enabled => {
          if (active) {
            confirmed = enabled;
            setState({ identity, enabled, busy: false, initializing: false, error: "", feedback: "" as Feedback });
          }
        })
        .catch(error => { if (active) setState({ identity, enabled: initial, busy: false, initializing: false, error: String(error), feedback: "" as Feedback }); });
    }
    return () => { active = false; writer.dispose(); if (queue.current === writer) queue.current = null; };
  }, [path, installed]);
  useEffect(() => {
    if (!state.feedback || state.identity !== identity) return;
    const timer = window.setTimeout(() => {
      setState(current => current === state ? { ...current, feedback: "" } : current);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [state, identity]);
  const enabled = state.identity === identity ? state.enabled : initial;
  const busy = state.identity === identity ? state.busy : installed;
  const initializing = state.identity === identity ? state.initializing : installed;
  const change = (value: boolean) => {
    if (!path || !installed || initializing || !queue.current || queueIdentity.current !== identity) return;
    // Show intent immediately. Saving never dims or locks the switch.
    setState({ identity, enabled: value, busy: true, initializing: false, error: "", feedback: "" as Feedback });
    queue.current.enqueue(value);
  };
  return { enabled, busy, initializing, feedback: state.identity === identity ? state.feedback : "", error: state.identity === identity ? state.error : "", change };
}
