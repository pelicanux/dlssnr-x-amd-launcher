#!/bin/bash

# DLSSNR Installer - Portable Setup
APP_NAME="DLSSNR X AMD"
BIN_NAME="dlssnr-x-amd"
ICON_NAME="dlssnr-x-amd.png"

INSTALL_BIN_DIR="$HOME/.local/bin"
INSTALL_ICON_DIR="$HOME/.local/share/icons"
INSTALL_DESKTOP_DIR="$HOME/.local/share/applications"

# Resolving paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
BIN_PATH="$SCRIPT_DIR/src-tauri/target/release/$BIN_NAME"
ICON_PATH="$SCRIPT_DIR/src-tauri/icons/128x128.png"

# Check if binary is next to script (if distributed as a simple folder)
if [ ! -f "$BIN_PATH" ]; then
    if [ -f "$SCRIPT_DIR/$BIN_NAME" ]; then
        BIN_PATH="$SCRIPT_DIR/$BIN_NAME"
    fi
    if [ -f "$SCRIPT_DIR/icon.png" ]; then
        ICON_PATH="$SCRIPT_DIR/icon.png"
    fi
fi

# Determine environment (Terminal vs GUI)
if [ -t 1 ]; then HAS_TTY=1; else HAS_TTY=0; fi
if command -v zenity &> /dev/null; then HAS_ZENITY=1; else HAS_ZENITY=0; fi

# Fallback to terminal emulator if no Zenity and running via double-click
if [ $HAS_ZENITY -eq 0 ] && [ $HAS_TTY -eq 0 ]; then
    for term in x-terminal-emulator gnome-terminal konsole xfce4-terminal mate-terminal lxterminal alacritty kitty xterm; do
        if command -v $term &> /dev/null; then
            exec "$term" -e "$0" "$@"
            exit 0
        fi
    done
    echo "Não foi possível encontrar um terminal ou o zenity." >&2
    exit 1
fi

msg() {
    if [ $HAS_ZENITY -eq 1 ]; then
        zenity --info --title="$APP_NAME" --text="$1" --width=450
    else
        echo -e "\n============================================="
        echo -e "   $APP_NAME"
        echo -e "============================================="
        echo -e "$1"
        echo -e "============================================="
        read -p "Pressione [ENTER] para fechar..."
    fi
}

ask() {
    if [ $HAS_ZENITY -eq 1 ]; then
        zenity --question --title="$APP_NAME" --text="$1" --width=450
        return $?
    else
        echo -e "\n============================================="
        echo -e "   $APP_NAME"
        echo -e "============================================="
        echo -e "$1"
        echo -e "============================================="
        read -p "Pressione [ENTER] para confirmar ou [CTRL+C] para cancelar..."
        return 0
    fi
}

# 1. Ask for confirmation
ask "Deseja instalar o $APP_NAME para o seu usuário?\n\nIsso criará um atalho no seu Menu de Aplicativos e copiará o executável para ~/.local/bin." || exit 1

# 2. Check for binary
if [ ! -f "$BIN_PATH" ]; then
    msg "ERRO: O executável do programa não foi encontrado em:\n$BIN_PATH\n\nCertifique-se de que o projeto foi compilado (target/release) ou que o binário está na mesma pasta do script."
    exit 1
fi

# 3. Create directories
mkdir -p "$INSTALL_BIN_DIR"
mkdir -p "$INSTALL_ICON_DIR"
mkdir -p "$INSTALL_DESKTOP_DIR"

# 4. Copy files
cp "$BIN_PATH" "$INSTALL_BIN_DIR/$BIN_NAME"
chmod +x "$INSTALL_BIN_DIR/$BIN_NAME"

if [ -f "$ICON_PATH" ]; then
    cp "$ICON_PATH" "$INSTALL_ICON_DIR/$ICON_NAME"
fi

# 5. Create Desktop Entry
cat > "$INSTALL_DESKTOP_DIR/$BIN_NAME.desktop" << EOF
[Desktop Entry]
Name=$APP_NAME
Comment=Configuração do DLSS Neural Rendering para AMD Linux
Exec=$INSTALL_BIN_DIR/$BIN_NAME
Icon=$INSTALL_ICON_DIR/$ICON_NAME
Terminal=false
Type=Application
Categories=Game;Utility;
EOF

chmod +x "$INSTALL_DESKTOP_DIR/$BIN_NAME.desktop"

# Refresh desktop database silently if tool exists
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$INSTALL_DESKTOP_DIR" &> /dev/null
fi

# 6. Check PATH
PATH_WARNING=""
if [[ ":$PATH:" != *":$INSTALL_BIN_DIR:"* ]]; then
    PATH_WARNING="\n\nAVISO: O diretório $INSTALL_BIN_DIR não parece estar no seu \$PATH.\nO atalho do menu vai funcionar normalmente, mas para abri-lo direto via terminal, talvez você precise adicionar 'export PATH=\"\$HOME/.local/bin:\$PATH\"' ao seu arquivo ~/.bashrc ou ~/.zshrc."
fi

msg "Instalação concluída com sucesso!\n\nO $APP_NAME foi integrado ao seu sistema e já deve aparecer no seu menu de aplicativos na categoria de Jogos/Utilitários.$PATH_WARNING"

exit 0
