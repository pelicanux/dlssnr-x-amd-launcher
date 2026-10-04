import type { ReactNode } from "react";

type IconName = "folder" | "calendar" | "platform" | "chip" | "graphics" | "puzzle" | "logs" | "document" | "settings" | "cube" | "keyboard" | "download" | "repair" | "bolt";
const drawings: Record<IconName, ReactNode> = {
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>,
  folder: <><path d="M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v2"/><path d="M3 8h17a1 1 0 0 1 1 1l-2 10H3a1 1 0 0 1-1-1L3 8Z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 11h18M8 15h2m4 0h2M8 18h2m4 0h2"/></>,
  platform: <><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/></>,
  graphics: <><rect x="5" y="6" width="16" height="12" rx="2"/><circle cx="13" cy="12" r="3"/><path d="M2 5v14h3M8 18v3h8v-3"/></>,
  puzzle: <path d="M6 5h4V4a2 2 0 0 1 4 0v1h4a1 1 0 0 1 1 1v4h1a2 2 0 0 1 0 4h-1v4a1 1 0 0 1-1 1h-4v-1a2 2 0 0 0-4 0v1H6a1 1 0 0 1-1-1v-4h1a2 2 0 0 0 0-4H5V6a1 1 0 0 1 1-1Z"/>,
  logs: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5M8 18h8"/></>,
  document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></>,
  settings: <><path d="M9.5 3h5l.6 2.4 1.6.9 2.4-.7 2.5 4.3-1.8 1.7v1.8l1.8 1.7-2.5 4.3-2.4-.7-1.6.9-.6 2.4h-5l-.6-2.4-1.6-.9-2.4.7-2.5-4.3 1.8-1.7v-1.8L2.4 9.9l2.5-4.3 2.4.7 1.6-.9L9.5 3Z"/><circle cx="12" cy="12" r="3"/></>,
  cube: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5m-9 5v10M7.5 4.5l9 5"/></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/></>,
  repair: <><path d="M3 11a9 9 0 0 1 15.36-5.36L21 8M21 13a9 9 0 0 1-15.36 5.36L3 16"/><path d="M21 3v5h-5M3 21v-5h5"/></>,
};

export function MenuIcon({ name }: { name: IconName }) {
  return <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "repair" ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[name]}</svg>;
}
