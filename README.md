<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" height="96" alt="Ícone do DLSSNR X AMD">
</p>

# DLSSNR X AMD

**Launcher e instalador DLSS Neural Rendering para AMD no Linux**, desenvolvido por [Pelicano · pelicanux](https://github.com/pelicanux).

Uma interface gráfica para organizar sua biblioteca, configurar o modelo de IA e instalar, reparar, atualizar ou remover o mod nos jogos. O launcher integra os backends [DLSSNR-AMD](https://github.com/mochizuki0323/DLSSNR-AMD) e [DLSSNR-RDNA3](https://github.com/mauri870/DLSSNR-RDNA3); a implementação do processamento neural pertence a esses projetos.

**[Baixar o launcher](https://github.com/pelicanux/dlssnr-x-amd-launcher/releases)** · **[Licença MIT](LICENSE)** · **[Créditos e licenças](#créditos-e-licenças)**

## Interface

![Biblioteca do DLSSNR X AMD em modo grid, com busca e capas dos jogos](docs/images/launcher-library.png)

Exemplo da biblioteca em modo grid, com a interface em português. Os jogos e as capas exibidos variam conforme a biblioteca do usuário.

## Recursos

- Biblioteca com jogos da Steam, do Heroic e de diretórios adicionados manualmente.
- Visualização em grid ou lista, busca e categorias recolhíveis.
- Setup inicial para escolher o backend e fornecer o arquivo `dlssnr.bin` ou extrair o modelo de uma DLL fornecida pelo usuário.
- Rotas de instalação OptiScaler, ReShade, Vulkan/DX9 e DX9 clássico, conforme os arquivos e a compatibilidade do backend escolhido.
- Instalação, reparo, atualização e remoção do mod, com acesso aos logs.
- Informações de plataforma, arquitetura, API gráfica e estado da instalação do jogo.
- Capas locais do Heroic, buscas em catálogos online e substituição manual persistente das capas.
- Interface em português e inglês, escala ajustável e modos Elegante e Desempenho.
- Verificação de atualizações do launcher e atualização dos backends em menus separados.

A primeira abertura faz a descoberta dos jogos. Nas seguintes, a biblioteca é carregada do cache; use **Escanear** para renovar a lista. **Limpar cache**, nas preferências, remove as informações de análise dos jogos para que sejam verificadas novamente, preservando a biblioteca, as capas e os arquivos do mod.

## Download e instalação

Os pacotes ficam nas **[Releases do repositório de distribuição](https://github.com/pelicanux/dlssnr-x-amd-launcher/releases)**. Este repositório contém o código-fonte do launcher.

| Formato | Uso |
| --- | --- |
| **AppImage** | Pacote portátil para Linux. Permita a execução do arquivo e abra-o. |
| **DEB** | Instale pelo gerenciador de pacotes do Debian, Ubuntu ou derivados compatíveis. |
| **RPM** | Instale pelo gerenciador de pacotes do Fedora ou de outras distribuições compatíveis. |

Escolha o pacote correspondente à arquitetura do computador. A disponibilidade de formatos e arquiteturas está indicada nos arquivos de cada Release.

### Primeiro uso

1. Abra o launcher e escolha o backend no setup inicial: **DLSSNR-AMD** ou **DLSSNR-RDNA3**.
2. Baixe os arquivos do backend pela interface ou selecione os arquivos locais disponíveis.
3. Em **Fonte do Modelo de IA**, selecione seu `dlssnr.bin` existente ou a DLL da qual deseja extrair o modelo.
4. Conclua o setup, selecione um jogo e confira a pasta, a arquitetura e a rota de instalação.
5. Instale o mod. Se o resultado apresentar opções de inicialização para Steam/Proton, use as instruções correspondentes à rota escolhida.

O launcher não inclui o backend nem o modelo de IA em seus pacotes. O modelo deve ser fornecido pelo usuário; a versão da DLL e os requisitos de execução devem seguir a documentação do backend escolhido.

### Compatibilidade

| Opção no launcher | Projeto responsável | Família indicada |
| --- | --- | --- |
| DLSSNR-AMD | [mochizuki0323/DLSSNR-AMD](https://github.com/mochizuki0323/DLSSNR-AMD) | RDNA 4 / Radeon RX 9000 |
| DLSSNR-RDNA3 | [mauri870/DLSSNR-RDNA3](https://github.com/mauri870/DLSSNR-RDNA3) | RDNA 3 / Radeon RX 7000 |

A compatibilidade do mod depende do backend, da GPU, dos drivers, da versão do Wine/Proton e do jogo. A detecção de um jogo na biblioteca não garante que ele suporte o mod. Consulte os requisitos e as limitações nos projetos originais antes da instalação.

A instalação modifica arquivos na pasta do jogo. Preserve seus arquivos originais e não utilize o mod em jogos online com anti-cheat, conforme as orientações do [backend original](https://github.com/mochizuki0323/DLSSNR-AMD#before-you-use-it).

## Desenvolvimento e compilação

O projeto utiliza **React, TypeScript e Vite** na interface e **Rust com Tauri 2** na camada nativa.

Requisitos:

- Rust e Cargo.
- Bun, utilizado pelos comandos de desenvolvimento e compilação configurados no projeto.
- Bibliotecas de desenvolvimento do Linux exigidas pelo Tauri 2. Consulte os [pré-requisitos oficiais por distribuição](https://v2.tauri.app/start/prerequisites/#linux).

```bash
git clone https://github.com/pelicanux/dlssnr-x-amd.git
cd dlssnr-x-amd
bun install
bun run tauri dev
```

Compile todos os formatos configurados para Linux:

```bash
bun run tauri build
```

Ou apenas o AppImage:

```bash
bun run tauri build --bundles appimage
```

Os pacotes ficam em `src-tauri/target/release/bundle/`, nas subpastas `appimage`, `deb` e `rpm`.

### Organização do código

| Caminho | Conteúdo |
| --- | --- |
| `src/` | Interface React/TypeScript, componentes, traduções e serviços do frontend. |
| `src-tauri/` | Aplicação Rust/Tauri, descoberta e análise dos jogos, integração com os backends e atualizações. |
| `licenses/` | Cópias dos avisos originais de licença e dos componentes de terceiros do backend. |
| `scripts/publish-release.sh` | Publicação dos pacotes no repositório de distribuição. |
| `install.sh` | Instalação local do próprio launcher e de seu atalho; não é o instalador do mod nos jogos. |

## Créditos e licenças

### Autoria do launcher e dos backends

| Projeto | Autoria e contribuição | Licença e avisos |
| --- | --- | --- |
| **DLSSNR X AMD** | [Pelicano · pelicanux](https://github.com/pelicanux): launcher, interface gráfica e integração com os backends no Linux. | [MIT — Copyright (c) 2026 Pelicano](LICENSE) |
| **DLSSNR-AMD** | [mochizuki0323](https://github.com/mochizuki0323): backend original e suas ferramentas de instalação/modelo, utilizados como base da integração. | [MIT original](https://github.com/mochizuki0323/DLSSNR-AMD/blob/main/LICENSE) · [Cópia preservada](licenses/DLSSNR-AMD-LICENSE.txt) |
| **DLSSNR-RDNA3** | [mauri870](https://github.com/mauri870): fork para RDNA 3, derivado do trabalho de mochizuki0323. | [MIT do fork](https://github.com/mauri870/DLSSNR-RDNA3/blob/main/LICENSE) · [Cópia preservada](licenses/DLSSNR-RDNA3-LICENSE.txt) |

O crédito ao launcher não substitui a autoria dos backends. Os avisos originais de copyright são preservados, incluindo **Copyright (c) 2026 mochizuki0323** no texto de licença do fork RDNA3. A interface do aplicativo também oferece acesso aos textos originais em **Sobre → Licenças e avisos**, inclusive offline.

### Tecnologias do launcher

| Tecnologia | Projeto | Licença |
| --- | --- | --- |
| React | [facebook/react](https://github.com/facebook/react) | MIT |
| Tauri 2 | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) | MIT ou Apache-2.0 |
| Motion / Framer Motion | [motiondivision/motion](https://github.com/motiondivision/motion) | MIT |
| TypeScript | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| Vite | [vitejs/vite](https://github.com/vitejs/vite) | MIT |

Essas tecnologias e suas dependências mantêm seus avisos originais. A tabela apresenta as principais bibliotecas e ferramentas, sem substituir as licenças completas de todas as dependências.

### Componentes utilizados pelo backend

O backend utiliza componentes com licenças próprias. Entre os componentes documentados pelo projeto original estão:

| Componente | Projeto de origem | Licença indicada pelo backend |
| --- | --- | --- |
| DLSS5-Feeder | [jlrouzies-fr/DLSS5-Feeder](https://github.com/jlrouzies-fr/DLSS5-Feeder) | MIT |
| OptiScaler-NR | [wilsjo2/OptiScaler-DLSSNR-PreSR-Multipass](https://github.com/wilsjo2/OptiScaler-DLSSNR-PreSR-Multipass) | GPL-3.0 |
| ReShade e shaders associados | [crosire/reshade](https://github.com/crosire/reshade) · [crosire/reshade-shaders](https://github.com/crosire/reshade-shaders) | BSD-3-Clause |
| vort_Shaders | [vortigern11/vort_Shaders](https://github.com/vortigern11/vort_Shaders) | MIT |
| MinHook | [TsudaKageyu/minhook](https://github.com/TsudaKageyu/minhook) | BSD-2-Clause |
| Dear ImGui | [ocornut/imgui](https://github.com/ocornut/imgui) | MIT |
| Vulkan-Loader e Vulkan-Headers | [KhronosGroup/Vulkan-Loader](https://github.com/KhronosGroup/Vulkan-Loader) · [Vulkan-Headers](https://github.com/KhronosGroup/Vulkan-Headers) | Apache-2.0; Headers também sob MIT |

Esta tabela é um resumo dos avisos do backend, não uma lista de arquivos incluídos nos pacotes do launcher. Consulte a [cópia dos avisos de terceiros](licenses/DLSSNR-AMD-THIRD-PARTY.md), a [documentação original de terceiros](https://github.com/mochizuki0323/DLSSNR-AMD/blob/main/THIRD_PARTY.md) e as licenças que acompanham cada versão baixada. Componentes como OptiScaler-NR **não passam a ser MIT** por serem integrados a este launcher.

### Modelo de IA e marcas

A DLL `nvngx_dlssnr.dll` e os pesos do modelo são de propriedade da NVIDIA e não são distribuídos neste repositório ou nos pacotes do launcher. A licença MIT do launcher não se aplica a esses arquivos nem concede direitos sobre eles.

Este é um projeto independente, sem afiliação, endosso ou suporte oficial da NVIDIA, AMD, Valve/Steam, Epic Games, GOG, Heroic ou SteamGridDB. DLSS e as demais marcas mencionadas pertencem aos respectivos titulares.

## Licença do launcher

O código próprio do **DLSSNR X AMD** está disponível sob a **[licença MIT](LICENSE)**. Ela permite utilizar, estudar, modificar, criar forks e redistribuir o código, inclusive comercialmente, preservando o aviso de copyright e o texto da licença nas cópias ou partes substanciais distribuídas. O software é fornecido sem garantia, conforme o texto da licença.

Os componentes de terceiros mantêm suas respectivas licenças e condições de distribuição. Consulte também o [índice de licenças](licenses/README.md).

## Contribuições e relatos de problemas

Correções, traduções, melhorias de interface e contribuições à integração são bem-vindas por issues e pull requests.

Ao relatar um problema, informe a versão do launcher, a distribuição Linux, a GPU, a versão do Wine/Proton, o jogo, o backend e a rota utilizada. Inclua os passos para reproduzir e os logs relevantes, removendo chaves pessoais e dados privados antes de compartilhar. Problemas específicos do processamento neural devem também ser conferidos no projeto do backend correspondente.
