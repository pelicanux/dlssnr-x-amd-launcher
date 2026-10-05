import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from "@tauri-apps/plugin-opener";

interface TitleBarProps {
  onShowCredits: () => void;
  settingsMenu?: React.ReactNode;
  updateIndicator?: React.ReactNode;
  disabled?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onShowCredits, settingsMenu, updateIndicator, disabled }) => {
  const { t } = useI18n();
  const appWindow = getCurrentWindow();

  const handleLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Failed to open link:", err);
      window.open(url, "_blank");
    }
  };

  return (
    <div className="app-titlebar"
      data-tauri-drag-region="true"
      style={{
        height: '50px',
        background: 'rgba(26, 26, 26, 0.4)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        userSelect: 'none',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        position: 'relative',
        zIndex: 2000
      }}
    >
      {/* Left section: Icon and Title */}
      <div data-tauri-drag-region="true" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', height: '100%' }}>
        <img src="/icon.png" alt="Icon" style={{ width: '24px', height: '24px', pointerEvents: 'none' }} />
        <span className="titlebar-title" data-tauri-drag-region="true" style={{ 
          fontFamily: "'Rajdhani', sans-serif", 
          margin: 0, 
          fontSize: "1.4rem", 
          fontWeight: "bold", 
          color: "#ffffff",
          letterSpacing: "1px" 
        }}>
          DLSSNR <span className="titlebar-x" data-tauri-drag-region="true" style={{ color: "#ED1C24" }}>X</span> <span className="titlebar-amd" data-tauri-drag-region="true">AMD</span>
        </span>
      </div>

      {/* Right section: Links and Window Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%' }}>
        <div inert={disabled} style={{ display: 'flex', alignItems: 'center', opacity: disabled ? 0.3 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
          {updateIndicator}
          {settingsMenu && (
            <div data-tauri-drag-region="false" style={{ display: 'flex', alignItems: 'center' }}>
              {settingsMenu}
            </div>
          )}
          <button 
            data-tauri-drag-region="false"
            className="btn-titlebar"
            disabled={disabled}
            onClick={onShowCredits}
            title={t("credits", "button")}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>

          <button 
            data-tauri-drag-region="false"
            className="btn-titlebar"
            disabled={disabled}
            onClick={() => handleLink("https://discord.gg/78XSB9bHst")}
            title="Discord"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', borderRadius: '4px', marginRight: '0.5rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.03.03.03.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.01.02.04.03.07.02 1.71-.53 3.44-1.33 5.24-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.03-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" /></svg>
          </button>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', marginRight: '0.5rem' }}></div>

        <button 
          data-tauri-drag-region="false"
          className="btn-titlebar window-control"
          onClick={() => appWindow.minimize()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button 
          data-tauri-drag-region="false"
          className="btn-titlebar window-control"
          onClick={() => appWindow.toggleMaximize()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        </button>
        <button 
          data-tauri-drag-region="false"
          className="btn-titlebar window-control close"
          onClick={() => appWindow.close()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  );
};
