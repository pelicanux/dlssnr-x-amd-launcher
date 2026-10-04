import { useI18n } from "../i18n/I18nContext";
import React from 'react';
import { openUrl } from "@tauri-apps/plugin-opener";
import { APP_BUILD_LABEL } from "../services/buildInfo";

interface Props {
  onClose: () => void;
}

export const CreditsModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useI18n();
  const handleLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Failed to open link:", err);
      window.open(url, "_blank");
    }
  };

  return (
    <div style={{ position: "fixed", top: "50px", left: 0, right: 0, height: "calc(100dvh - 50px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      
      <div className="modal-content dialog-glass credits-dialog" style={{ 
        background: "rgba(10, 5, 10, 0.95)", 
        padding: "1.5rem", 
        borderRadius: "16px", 
        width: "90%", 
        maxWidth: "450px", 
        zIndex: 1, 
        border: "1px solid rgba(237, 28, 36, 0.4)", 
        boxShadow: "0 0 60px rgba(237, 28, 36, 0.25)" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ED1C24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "1.3rem" }}>{t("credits", "title")}</h2>
        </div>
        
        {/* Banner Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{
            width: "80px", height: "80px", flexShrink: 0, boxSizing: "border-box", borderRadius: "12px", background: "rgba(237,28,36,0.1)",
            border: "1px solid rgba(237,28,36,0.5)", overflow: "hidden", boxShadow: "0 0 20px rgba(237,28,36,0.4)"
          }}>
            <img src="/icon.png" alt="Logo" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <h3 className="titlebar-title" style={{ margin: 0, width: "fit-content", color: "#fff", fontSize: "1.3rem" }}>DLSSNR <span className="titlebar-x" style={{ color: "#ED1C24" }}>X</span> <span className="titlebar-amd">AMD</span></h3>
            <div style={{ color: "#e2e8f0", fontSize: "0.9rem", marginTop: "0.2rem" }}>{t("credits", "devBy")}</div>
            <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>{t("credits", "description")}</div>
          </div>
        </div>

        {/* Comunidade */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ED1C24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          <h4 style={{ margin: 0, color: "#fff", fontSize: "1rem" }}>{t("credits", "community")}</h4>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
          {/* Apoie o projeto */}
          <div 
            style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(237,28,36,0.1)", border: "1px solid rgba(237,28,36,0.4)", borderRadius: "8px", padding: "0.8rem", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => handleLink("https://livepix.gg/thepelicano")}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(237,28,36,0.2)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(237,28,36,0.1)"}
          >
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(237,28,36,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ED1C24" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.95rem" }}>{t("credits", "support")}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>LivePix</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            {/* YouTube */}
            <div 
              style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.8rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "0.8rem", cursor: "pointer", transition: "all 0.2s" }}
              onClick={() => handleLink("https://www.youtube.com/@Pelicanux/")}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon fill="#fff" points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>YouTube</div>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>@Pelicanux</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </div>
            {/* Discord */}
            <div 
              style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.8rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "0.8rem", cursor: "pointer", transition: "all 0.2s" }}
              onClick={() => handleLink("https://discord.gg/78XSB9bHst")}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.03.03.03.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.01.02.04.03.07.02 1.71-.53 3.44-1.33 5.24-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.03-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" /></svg>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>Discord</div>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{t("credits", "community")}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </div>
          </div>
        </div>

        {/* Projetos e créditos */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ED1C24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          <h4 style={{ margin: 0, color: "#fff", fontSize: "1rem" }}>{t("credits", "projects")}</h4>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div 
            style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => handleLink("https://github.com/mochizuki0323/DLSSNR-AMD")}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>Backend</div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>mochizuki0323 / DLSSNR-AMD</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>

          <div 
            style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => handleLink("https://github.com/pelicanux")}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>Frontend</div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>github.com/pelicanux</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>

          <div 
            style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => handleLink("https://github.com/mauri870/DLSSNR-RDNA3")}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>{t("credits", "forkRdna3")}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>mauri870 / DLSSNR-RDNA3</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>{APP_BUILD_LABEL}</span>
          <button 
            onClick={onClose}
            style={{ 
              background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", 
              padding: "0.6rem 1.5rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          >
            {t("resultModal", "close")}
          </button>
        </div>
      </div>
    </div>
  );
};
