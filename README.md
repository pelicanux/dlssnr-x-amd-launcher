# DLSSNR X AMD

Launcher e instalador de DLSS Neural Rendering para AMD no Linux, desenvolvido por Pelicano.

A interface permite localizar jogos, configurar o backend AMD/RDNA3, selecionar o modelo de IA e instalar, reparar ou remover o mod.

## Desenvolvimento

Requisitos: Rust, dependências de sistema do Tauri 2 para Linux e Bun (ou Node.js com um gerenciador de pacotes).

```sh
bun install
bun run tauri dev
```

Para compilar um AppImage:

```sh
bun run tauri build --bundles appimage
```

Os arquivos compilados ficam em `src-tauri/target/release/bundle/appimage/`. Binários de distribuição devem ser publicados nas Releases do GitHub.

## Capas dos jogos

As capas da Steam são usadas quando disponíveis. A integração com SteamGridDB usa uma chave opcional: copie `.env.example` para `.env.local` e preencha `VITE_STEAMGRIDDB_API_KEY` com sua própria chave antes de compilar.

A chave configurada pelo Vite será incorporada ao aplicativo compilado. Excluir o arquivo de configuração do Git protege o repositório, mas não torna essa chave secreta dentro do AppImage.

## Componentes de terceiros

- [DLSSNR-AMD](https://github.com/mochizuki0323/DLSSNR-AMD), por mochizuki0323.
- [DLSSNR-RDNA3](https://github.com/mauri870/DLSSNR-RDNA3), por mauri870.

Os backends são baixados pelo aplicativo e mantêm suas próprias licenças. O modelo de IA não é incluído: o usuário precisa fornecer seu arquivo ou extraí-lo de uma DLL. Consulte os avisos de licença dos projetos originais.

Este projeto é independente e não é afiliado à NVIDIA ou AMD.

## Licença

O código deste launcher é disponibilizado sob [MIT](LICENSE), Copyright (c) 2026 Pelicano. Componentes de terceiros mantêm suas respectivas licenças e avisos de autoria.
