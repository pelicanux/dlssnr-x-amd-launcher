import { useI18n } from "../i18n/I18nContext";
import React, { useState, useRef } from "react";
import "../App.css";
import { createPortal } from "react-dom";
import { useBoundedDropdown } from "../hooks/useBoundedDropdown";
import { defaultShortcutForRoute } from "../services/routeDefaults";

interface Props {
  shortcutKey: string;
  setShortcutKey: (key: string) => void;
  route?: string;
}

export const ShortcutKeySelector: React.FC<Props> = ({ shortcutKey, setShortcutKey, route }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const menuPosition = useBoundedDropdown(isOpen, dropdownRef, menuRef, setIsOpen);
  const defaultKey = defaultShortcutForRoute(route);

  const options = [
    { value: "Insert", label: "Insert", desc: defaultKey === "Insert" ? t("gameInfo", "defaultKey") : "" },
    { value: "End", label: "End", desc: "" },
    { value: "Home", label: "Home", desc: defaultKey === "Home" ? t("gameInfo", "defaultKey") : "" },
    { value: "Page Up", label: "Page Up", desc: "" },
    { value: "Page Down", label: "Page Down", desc: "" },
    { value: "Delete", label: "Delete", desc: "" },
    { value: "F1", label: "F1", desc: "" },
    { value: "F2", label: "F2", desc: "" },
    { value: "F11", label: "F11", desc: "" },
    { value: "F12", label: "F12", desc: "" },
  ];

  const selectedOption = options.find((opt) => opt.value === shortcutKey) || options[0];

  return (
    <div className="card">
      <h3 style={{ fontSize: "0.95rem", margin: 0, marginBottom: "0.5rem" }}>{t("gameInfo", "menuKey")}</h3>
      <div className="custom-select-wrapper" ref={dropdownRef} style={{ position: "relative", height: "100%" }}>
        <div 
          className={`custom-select-trigger ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
            <span style={{ fontWeight: 600 }}>{selectedOption.label} <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{selectedOption.desc}</span></span>
          </div>
          <div className="select-arrow">▼</div>
        </div>
        
        {isOpen && createPortal(
          <div ref={menuRef} className="custom-select-menu route-select-menu" style={menuPosition}>
            {options.map((opt) => (
              <div 
                key={opt.value} 
                className={`custom-select-option ${shortcutKey === opt.value ? "selected" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setShortcutKey(opt.value);
                  setIsOpen(false);
                }}
              >
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
                {opt.desc && <span style={{ fontSize: "0.8rem", opacity: 0.7, marginLeft: "0.5rem" }}>{opt.desc}</span>}
              </div>
            ))}
          </div>, document.body
        )}
      </div>
    </div>
  );
};
