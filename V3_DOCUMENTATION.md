# Documentação do DLSSNR Installer V3

## O que é este programa?
O **DLSSNR Installer** é um utilitário completo (GUI) voltado para facilitar a vida de jogadores no Linux que utilizam Proton ou Wine. Ele automatiza completamente o processo de download, extração, injeção e configuração das DLLs de mod de Frame Generation (DLSS Enabler/FSR3) criadas pela comunidade (como os forks `DLSSNR-AMD` e `DLSSNR-RDNA3`).

**Principais funcionalidades e propósitos:**
1. **Varredura Automática:** Ele procura em todas as suas partições, discos e pastas conhecidas da Steam e do Heroic Games Launcher por jogos instalados, listando-os em uma interface gráfica elegante com suas respectivas capas baixadas via API.
2. **Setup Simplificado:** Em vez de abrir terminais, definir variáveis do Wine ou gerenciar o download da biblioteca ReShade e do OptiScaler à mão, o programa oferece opções em 1 clique.
3. **Gerenciamento de Mods em Lote:** O utilitário detecta automaticamente onde o executável principal do jogo fica e joga os arquivos e scripts corretos lá dentro, atualizando arquivos `.ini` (como `optiscaler.ini` e `reshade.ini`) injetando as teclas de atalho que você escolher pelo painel.
4. **Verificações e Restauração de Ambiente:** Quando operado como AppImage ou Flatpak, o backend isolado do Rust limpa o ambiente antes de aplicar o mod no jogo, permitindo que a injeção em Python rode com segurança no Linux nativo sem quebrar com bibliotecas misturadas.

Este documento serve como referência de contexto para futuras conversas com a IA. Ele detalha as principais modificações arquiteturais introduzidas na versão 3 (V3) comparada à versão 2 (V2).

## Resumo das Novidades
A versão V3 transformou o instalador simples (V2) em uma **Galeria Inteligente de Jogos**. O aplicativo agora detecta automaticamente jogos instalados no PC (via Steam e Heroic), puxa as capas pela internet (via API da SteamGridDB) e pré-preenche o formulário de diretório ao clicar em uma capa.

## Modificações no Backend (Rust)
Foi criado o módulo responsável pela varredura: `src-tauri/src/commands/scanner.rs`.
As seguintes rotinas de leitura de arquivos foram criadas:
- `scan_steam()`: Varre os diretórios nativos e flatpak da Steam (`.local/share/Steam/config/libraryfolders.vdf`, etc.), procurando arquivos `.acf` para identificar AppIDs, Nomes e Pastas.
- `scan_heroic()`: Varre os arquivos `installed.json` (Nativo e Flatpak) das lojas GOG, Legendary/Epic dentro de `~/.config/heroic`.
- `fetch_steamgriddb_cover()`: Consome a API pública do SteamGridDB (utilizando uma chave providenciada) para procurar o nome do jogo e retornar a URL da arte (Grid de proporção 600x900).

Esse módulo expõe o comando Tauri: `scan_installed_games(api_key: String) -> Result<Vec<GameInfo>, String>`.

Dependências Rust Adicionadas (`Cargo.toml`):
- `reqwest` (já presente, utilizado para chamadas de API do SteamGridDB)
- `urlencoding` (para escapar os nomes de jogos na busca da API)

## Modificações no Frontend (React)
- **Novo Componente:** `src/components/GameGrid.tsx`. Renderiza a grade de capas inspirada na UI da Steam/GOG. Utiliza CSS grid, skeleton screen ("Procurando seus jogos...") e _fallback covers_ caso a capa da internet não carregue.
- **Integração no `App.tsx`:** O componente `<GameGrid />` foi injetado antes da seção do formulário. Ele usa a variável de estado `showGrid` (boolean). Quando uma capa é clicada na tela principal, o React chama a função de seleção que:
  1. Define o `gameDir` via estado.
  2. Esconde o grid (`setShowGrid(false)`).
  3. Exibe um botão para reativar o grid ("Mostrar Grade de Jogos").
- **Traduções (`src/i18n/translations.ts`):** Adicionadas chaves de tradução: `showGameGrid`, `scanningGames`, `detectedGames` para pt/en.

## Como Continuar o Desenvolvimento (Dicas para a IA da próxima conversa)
1. Ao iniciar o trabalho no V3, lembre-se que agora o fluxo do usuário pode começar selecionando um card da grade em vez de abrir o file picker do diretório de instalação.
2. A detecção pode ser expandida no futuro para Lutris (parse de SQLite) ou verificações heurísticas (`d3d12.dll` x `dxgi.dll`) no momento em que a varredura encontra a pasta.
## Detalhes Técnicos e Aprendizados Recentes (V3)
1. **Desempenho de UI e Crash no Linux**: Evite injetar variáveis como `WEBKIT_DISABLE_DMABUF_RENDERER=1`. Embora resolva alertas inofensivos de _Core Dump_ do WebKitWebProcess ao fechar a janela em distribuições bleeding-edge, ela destrói o desempenho das animações CSS 3D do grid de jogos. O erro de fechamento é inofensivo, devendo-se priorizar a fluidez visual.
2. **Jogos Avulsos (Custom Folders)**: O usuário pode importar diretórios externos de jogos não-Steam. O front-end usa `@tauri-apps/plugin-dialog` para salvar pastas e passa a lista para o Rust, que faz uma varredura recursiva (limite de 3 níveis de profundidade) buscando arquivos `.exe` para validar a legitimidade do diretório antes de adicioná-lo à grade.
3. **Integração com o SO (Abrir Pasta)**: Para jogos não-Steam, a UI mostra "Abrir Pasta". Em vez de forjar uma chamada de sistema insegura via `std::process::Command`, usamos a API `@tauri-apps/plugin-opener` (`openPath`) diretamente no React para abrir o diretório de maneira estável (solucionando problemas de sandbox em flatpaks/Wayland).

## Como Compilar o Projeto V3

O projeto exige o uso de um container Podman pré-configurado (`ubuntu-dev`). 

### 1. Compilação Completa na RAM (AppImage, RPM, DEB e TAR.GZ Portátil)
Para acelerar o processo (evitando gargalos de I/O de disco) e prevenir travamentos por "Text file busy" ao tentar sobrescrever binários em uso, a compilação agora é feita inteiramente na RAM (`/tmp/tauri-target`).

Comando mestre utilizado para compilar o app na RAM, copiar os pacotes finais para a pasta `src-tauri/target/release/`, e empacotar um bundle `.tar.gz` contendo o binário bruto:

```bash
podman exec -e TZ=America/Sao_Paulo -e CARGO_TARGET_DIR=/tmp/tauri-target -u pelicano ubuntu-dev sh -c "export PATH=~/.cargo/bin:\$PATH && cd /home/pelicano/Documents/antigravity/dlss5-amd/dlssnr-installer-v3 && ~/.bun/bin/bun run tauri build && rm -rf /home/pelicano/Documents/antigravity/dlss5-amd/dlssnr-installer-v3/src-tauri/target/release/bundle && cp -r /tmp/tauri-target/release/bundle /home/pelicano/Documents/antigravity/dlss5-amd/dlssnr-installer-v3/src-tauri/target/release/ && rm -f /home/pelicano/Documents/antigravity/dlss5-amd/dlssnr-installer-v3/src-tauri/target/release/dlssnr-installer && cp /tmp/tauri-target/release/dlssnr-installer /home/pelicano/Documents/antigravity/dlss5-amd/dlssnr-installer-v3/src-tauri/target/release/" && mkdir -p /tmp/dlssnr-installer-package/dlssnr-installer-v3 && cp install.sh /tmp/dlssnr-installer-package/dlssnr-installer-v3/ && cp src-tauri/target/release/dlssnr-installer /tmp/dlssnr-installer-package/dlssnr-installer-v3/ && cp src-tauri/icons/128x128.png /tmp/dlssnr-installer-package/dlssnr-installer-v3/icon.png && tar -czvf src-tauri/target/release/dlssnr-installer-linux-v0.5.0.tar.gz -C /tmp/dlssnr-installer-package dlssnr-installer-v3 && rm -rf /tmp/dlssnr-installer-package
```
*(Destaque para o `rm -f` antes do `cp` no binário executável para sobrepor mesmo se o app estiver aberto).*
