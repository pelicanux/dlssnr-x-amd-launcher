#!/usr/bin/env python3
"""Apply the audited launcher patch only to the pinned OptiScaler-NR source."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

project = Path(__file__).resolve().parents[1]
metadata = json.loads((project / 'native/optiscaler-live/upstream.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
menu = args.source / 'OptiScaler/menu/menu_common.cpp'
original = menu.read_bytes().replace(b'\r\n', b'\n')
if hashlib.sha256(original).hexdigest() != metadata['menu_sha256']:
    raise SystemExit('OptiScaler source differs from audited v0.8.4; refusing to patch it.')
text = original.decode('utf-8-sig')
include = '#include "menu_common.h"'
anchor = 'void MenuCommon::Present()\n{'
render_anchor = 'void MenuCommon::UpdateRenderTiming(RenderMenuContext& ctx)\n{'
if text.count(include) != 1 or text.count(anchor) != 1 or text.count(render_anchor) != 1:
    raise SystemExit('Expected integration points were not found.')
helper = '''extern "C" __declspec(dllexport) int DLSSNR_LauncherControlProtocolV1() { return 1; }

static void PollDlssNrLauncherControl()
{
    static DlssNrLauncher::Receiver receiver;
    receiver.Poll(Util::DllPath().parent_path(), [](bool enabled) {
        auto config = Config::Instance();
        if (config == nullptr) return false;
        config->DlssNrEnabled = enabled;
        return config->DlssNrEnabled.value_or_default() == enabled;
    });
}

'''
text = text.replace(include, include + '\n#include <dlssnr/LauncherControl.h>', 1)
text = text.replace(anchor, helper + anchor + '\n    PollDlssNrLauncherControl();', 1)
# Overlay mode can update frame timing without calling Present. Poll is throttled.
text = text.replace(render_anchor, render_anchor + '\n    PollDlssNrLauncherControl();', 1)
header = args.source / 'OptiScaler/dlssnr/LauncherControl.h'
shutil.copyfile(project / 'native/optiscaler-live/LauncherControl.h', header)
menu.write_bytes(b'\xef\xbb\xbf' + text.encode('utf-8'))
shutil.copytree(project / 'native/optiscaler-live', args.source / 'LauncherControlSource', dirs_exist_ok=True)
print('Applied GPLv3 launcher control patch to OptiScaler-NR v0.8.4.')
