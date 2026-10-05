import { useI18n } from "../i18n/I18nContext";

interface BitnessSelectorProps {
  bitness: "32" | "64";
  setBitness: (b: "32" | "64") => void;
  recommended?: "32" | "64" | null;
  gpuArch: "rdna3" | "rdna4";
}

export function BitnessSelector({ bitness, setBitness, gpuArch, recommended }: BitnessSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="card bitness-card">
      <h3 style={{ fontSize: "0.95rem" }}>{t("bitness", "title")}</h3>
      <div className="radio-group" style={{ height: "100%", gap: "0.5rem", display: "flex", flexDirection: "row" }}>
        <label className={`radio-label ${bitness === "64" ? "active" : ""}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: "0.5rem", padding: "0.3rem 0.5rem", flex: 1 }}>
          <input
            type="radio"
            value="64"
            checked={bitness === "64"}
            onChange={(e) => setBitness(e.target.value as "64")}
            style={{ marginTop: "0.2rem" }}
          />
          <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", flexDirection: "column" }}>
            {t("bitness", "x64")}
            {recommended === "64" && <span style={{ color: "#6ee7b7", fontSize: "0.65rem", whiteSpace: "nowrap" }}>✓ {t("bitness", "recommended")}</span>}
            <span style={{ fontSize: "0.7rem", opacity: 0.7, fontWeight: "normal", marginTop: "2px" }}>{t("bitness", "x64desc")}</span>
          </span>
        </label>
        <label className={`radio-label ${bitness === "32" ? "active" : ""} ${gpuArch === "rdna3" ? "disabled" : ""}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: "0.5rem", padding: "0.3rem 0.5rem", opacity: gpuArch === "rdna3" ? 0.5 : 1, cursor: gpuArch === "rdna3" ? "not-allowed" : "pointer", flex: 1 }}>
          <input
            type="radio"
            value="32"
            checked={bitness === "32"}
            disabled={gpuArch === "rdna3"}
            onChange={(e) => setBitness(e.target.value as "32")}
            style={{ marginTop: "0.2rem" }}
          />
          <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", flexDirection: "column" }}>
            {t("bitness", "x86")}
            {recommended === "32" && <span style={{ color: "#6ee7b7", fontSize: "0.65rem", whiteSpace: "nowrap" }}>✓ {t("bitness", "recommended")}</span>}
            <span style={{ fontSize: "0.7rem", opacity: 0.7, fontWeight: "normal", marginTop: "2px", lineHeight: "1.2" }}>
              {gpuArch === "rdna3" ? t("bitness", "x86incompat") : t("bitness", "x86desc")}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
