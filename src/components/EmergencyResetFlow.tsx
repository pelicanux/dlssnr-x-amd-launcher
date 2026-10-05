import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n/I18nContext";

export function EmergencyResetFlow({ stage, onStage }: { stage: number; onStage: (stage: number) => void }) {
  const { language } = useI18n();
  const en = language === "en";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (stage === 3) { setError(""); cancel.current?.focus(); } }, [stage]);
  useEffect(() => () => document.body.classList.remove("emergency-melting"), []);
  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    document.body.classList.add("emergency-melting");
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 1500));
      await invoke("emergency_reset_launcher");
      localStorage.clear();
      sessionStorage.clear();
      await invoke("restart_after_emergency_reset");
    } catch (err) {
      document.body.classList.remove("emergency-melting");
      setError(`${en ? "Reset failed" : "Falha ao redefinir"}: ${String(err)}`);
      setBusy(false);
    }
  };
  return <>
    {(stage === 1 || stage === 2) && <div className="emergency-step-row">
      <button className={`emergency-step emergency-step-${stage}`} onClick={() => onStage(stage + 1)}>
        {stage === 1 ? (en ? "Do not click here" : "Não clique aqui") : "¿Estás seguro?"}
      </button>
      <button className="emergency-cancel-link" onClick={() => onStage(0)}>{en ? "Cancel" : "Cancelar"}</button>
    </div>}
    {stage === 3 && createPortal(<div className="modal-overlay emergency-overlay" onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); onStage(0); }
      if (event.key === "Tab") {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <div className="modal-content emergency-dialog" role="dialog" aria-modal="true" aria-labelledby="emergency-quote" aria-describedby="emergency-warning" aria-busy={busy}>
        <span className="emergency-eyebrow">{en ? "POINT OF NO RETURN" : "PONTO SEM RETORNO"}</span>
        <h2 id="emergency-quote">{en ? "With great power comes great responsibility." : "Com grandes poderes vêm grandes responsabilidades."}</h2>
        <p id="emergency-warning">{en
          ? "This deletes the launcher's dlssnr-x-amd folder in your configuration directory: settings, backend files, AI model and logs. Custom cover selections, cached game information and preferences will also be reset. The application will restart automatically and return to initial setup. Your games and mods installed in them remain untouched."
          : "Isso apaga a pasta dlssnr-x-amd do launcher no seu diretório de configuração: configurações, arquivos do backend, modelo de IA e logs. As escolhas de capas personalizadas, as informações em cache e as preferências também serão redefinidas. O aplicativo reiniciará automaticamente e voltará à configuração inicial. Seus jogos e os mods instalados neles serão preservados."}</p>
        {error && <p role="alert" className="emergency-error">{error}</p>}
        <div className="emergency-actions">
          <button ref={cancel} className="btn btn-secondary" disabled={busy} onClick={() => onStage(0)}>{en ? "Cancel" : "Cancelar"}</button>
          <button className="emergency-confirm" disabled={busy} onClick={reset}>{busy ? (en ? "Resetting…" : "Redefinindo…") : (en ? "Confirm" : "Confirmar")}</button>
        </div>
      </div>
    </div>, document.body)}
    {busy && createPortal(<div className="emergency-fracture" aria-hidden="true"><svg viewBox="0 0 1000 700" preserveAspectRatio="none"><path d="M520 330 470 270 490 220 400 120 420 0 M520 330 600 290 640 170 740 110 800 0 M520 330 650 360 700 310 850 380 1000 350 M520 330 540 450 620 510 570 600 650 700 M520 330 410 400 300 370 190 480 0 450 M520 330 330 270 240 300 150 220 0 190"/></svg></div>, document.body)}
  </>;
}
