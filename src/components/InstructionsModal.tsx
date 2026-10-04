import React from 'react';
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onClose: () => void;
}

export const InstructionsModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div style={{ position: "fixed", top: "50px", left: 0, right: 0, height: "calc(100vh - 50px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      
      <div className="modal-content dialog-glass" style={{ background: "#1e1b4b", padding: "2rem", borderRadius: "12px", width: "90%", maxWidth: "600px", zIndex: 1, border: "1px solid rgba(139, 92, 246, 0.3)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)" }}>
        <h2 style={{ margin: "0 0 1.5rem 0", color: "#c4b5fd", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Instruções de Uso
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", color: "#e2e8f0", lineHeight: "1.6" }}>
          <p style={{ margin: 0 }}>Siga estes passos simples para instalar o mod:</p>
          
          <ol style={{ margin: 0, paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li><strong>Atualizar Backend:</strong> Clique no botão <code style={{ background: "rgba(0,0,0,0.3)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>Atualizar Backend</code>, selecione a arquitetura da sua placa de vídeo (ex: RDNA4 para RX 9000 ou RDNA3 para RX 7000) e baixe ou selecione a pasta com os arquivos corretos.</li>
            <li><strong>Selecione o Jogo:</strong> Escolha um jogo na grade ou selecione manualmente a pasta onde fica o arquivo executável (.exe) do jogo.</li>
            <li><strong>Forneça o Modelo IA:</strong> O mod requer o modelo da NVIDIA. Você pode fornecê-lo de duas formas:
              <ul style={{ marginTop: "0.25rem", paddingLeft: "1.5rem" }}>
                <li>Se você já tem o arquivo <code style={{ background: "rgba(0,0,0,0.3)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>dlssnr.bin</code>, basta selecioná-lo.</li>
                <li>Se você não tem, pode selecionar o arquivo <code style={{ background: "rgba(0,0,0,0.3)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>nvngx_dlssnr.dll</code> (encontrado em jogos oficiais com suporte a DLSS 5). O programa irá extrair o modelo e gerar o <code style={{ background: "rgba(0,0,0,0.3)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>dlssnr.bin</code> para você.</li>
              </ul>
            </li>
            <li><strong>Modo de Instalação:</strong> Escolha entre OptiScaler (recomendado para a maioria dos jogos 64-bits com suporte nativo a FSR/DLSS) ou ReShade (para jogos mais antigos ou sem suporte nativo a upscaling).</li>
            <li><strong>Clique em Instalar:</strong> Confirme a arquitetura e clique em Instalar para aplicar o mod no jogo selecionado.</li>
          </ol>

          <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold" }}>Ainda tem dúvidas ou encontrou um problema?</p>
            <button 
              className="btn btn-secondary" 
              onClick={() => invoke('open_url', { url: "https://discord.gg/M5BvWWeQ" })}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "#5865F2", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
              Entre no nosso Discord
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button className="primary" onClick={onClose} style={{ padding: "0.5rem 1.5rem" }}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
