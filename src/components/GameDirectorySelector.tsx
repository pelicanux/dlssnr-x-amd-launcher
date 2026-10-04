import { openDirectoryPicker } from "../services/tauriService";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  gameDir: string;
  setGameDir: (dir: string) => void;
}

/**
 * Component for selecting the game's executable directory.
 */
export const GameDirectorySelector: React.FC<Props> = ({ gameDir, setGameDir }) => {
  const { t } = useI18n();
  const handlePickGameDir = async () => {
    const path = await openDirectoryPicker();
    if (path) {
      setGameDir(path);
    }
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: "0.95rem", margin: 0 }}>{t("gameDir", "title")}</h3>
      <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0.2rem 0 0.3rem 0" }}>
        {t("gameDir", "desc")}
      </p>
      <div className="row">
        <input
          type="text"
          readOnly
          placeholder={t("gameDir", "placeholder")}
          value={gameDir}
          title={gameDir || t("gameDir", "placeholder")}
        />
        <button onClick={handlePickGameDir} style={{ padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)" }} title={t("gameDir", "browse")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><circle cx="12" cy="13" r="3"/><line x1="14.12" y1="15.12" x2="16" y2="17"/></svg>
        </button>
      </div>
    </div>
  );
};
