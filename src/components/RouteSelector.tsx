import React, { useState, useRef } from "react";
import { useBoundedDropdown } from "../hooks/useBoundedDropdown";
import { createPortal } from "react-dom";
import { InstallRoute } from "../types/installer";
import { useI18n } from "../i18n/I18nContext";
import "../App.css";

interface Props {
  route: InstallRoute;
  setRoute: (route: InstallRoute) => void;
  bitness: "32" | "64";
}

export const RouteSelector: React.FC<Props> = ({ route, setRoute, bitness }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPosition = useBoundedDropdown(isOpen, dropdownRef, menuRef, setIsOpen);
  const { t } = useI18n();

  const options: { value: InstallRoute; label: string; desc?: string; disabled?: boolean }[] = [
    { value: "optiscaler", label: t("routeSelector", "optiscaler"), desc: t("routeSelector", "optiscalerDesc"), disabled: bitness === "32" },
    { value: "reshade", label: t("routeSelector", "reshade"), desc: t("routeSelector", "reshadeDesc") },
    { value: "vulkan", label: t("routeSelector", "vulkan"), desc: t("routeSelector", "vulkanDesc") },
    { value: "dx9", label: t("routeSelector", "dx9"), desc: t("routeSelector", "dx9Desc") },
  ];

  const selectedOption = options.find((opt) => opt.value === route) || options[0];

  return (
    <div className="card">
      <h3 style={{ fontSize: "0.95rem", margin: 0, marginBottom: "0.5rem" }}>{t("routeSelector", "title")}</h3>
      <div className="custom-select-wrapper" ref={dropdownRef} style={{ position: "relative", height: "100%" }}>
        <div 
          className={`custom-select-trigger ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
            <span style={{ fontWeight: 600 }}>{selectedOption.label}</span>
            <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{selectedOption.desc}</span>
          </div>
          <div className="select-arrow">▼</div>
        </div>
        
        {isOpen && createPortal(
          <div ref={menuRef} className="custom-select-menu route-select-menu" style={menuPosition}>
            {options.map((opt) => (
              <div 
                key={opt.value} 
                className={`custom-select-option ${route === opt.value ? "selected" : ""} ${opt.disabled ? "disabled" : ""}`}
                style={{ opacity: opt.disabled ? 0.5 : 1, cursor: opt.disabled ? "not-allowed" : "pointer" }}
                onClick={() => {
                  if (opt.disabled) return;
                  setRoute(opt.value);
                  setIsOpen(false);
                }}
              >
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7, marginLeft: "0.5rem" }}>{opt.desc}</span>
              </div>
            ))}
          </div>, document.body
        )}
      </div>
    </div>
  );
};
