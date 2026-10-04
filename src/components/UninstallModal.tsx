import { useI18n } from "../i18n/I18nContext";
import "../App.css";

interface Props {
  onCancel: () => void;
  onPickDirectory: () => void;
}

export const UninstallModal: React.FC<Props> = ({ onCancel, onPickDirectory }) => {
  const { t } = useI18n();
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{t("uninstallModal", "title")}</h2>
        <div className="modal-body">
          <p>
            {t("uninstallModal", "description")}
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <button className="btn-primary" onClick={onPickDirectory} style={{ width: "100%" }}>
              {t("uninstallModal", "selectGameDir")}
            </button>
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
          <button className="btn-secondary" onClick={onCancel}>{t("uninstallModal", "cancel")}</button>
        </div>
      </div>
    </div>
  );
};
