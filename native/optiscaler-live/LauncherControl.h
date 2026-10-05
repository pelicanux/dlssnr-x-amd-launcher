// SPDX-License-Identifier: GPL-3.0-only
// DLSSNR launcher integration for OptiScaler-NR v0.8.4.
// Copyright (C) 2026 Pelicano / pelicanux
#pragma once
#include <chrono>
#include <filesystem>
#include <fstream>
#include <string>
#ifdef _WIN32
#include <Windows.h>
#endif

namespace DlssNrLauncher {
class Receiver {
    std::string processed;
    std::chrono::steady_clock::time_point nextPoll{};
public:
    // Invoke on the same frame thread as the existing NR checkbox/keybind.
    // Consume commands once: a subsequent change made in the game wins.
    template <typename Apply>
    void Poll(const std::filesystem::path& directory, Apply apply) noexcept {
        try {
            const auto now = std::chrono::steady_clock::now();
            if (now < nextPoll) return;
            nextPoll = now + std::chrono::milliseconds(150);
            std::ifstream input(directory / "dlssnr-launcher-command.txt", std::ios::binary);
            char bytes[41]{};
            input.read(bytes, sizeof(bytes));
            if (input.gcount() != 39) return;
            const std::string command(bytes, 39), id = command.substr(0, 36);
            for (unsigned i = 0; i < 36; ++i) {
                if (i == 8 || i == 13 || i == 18 || i == 23) { if (id[i] != '-') return; }
                else if (!((id[i] >= '0' && id[i] <= '9') || (id[i] >= 'a' && id[i] <= 'f'))) return;
            }
            if (command[36] != '\n' || command[38] != '\n' || (command[37] != '0' && command[37] != '1')) return;
            if (processed == id) return;
            // The callback sets and verifies the actual in-memory Config value.
            if (!apply(command[37] == '1')) return;
            const auto temporary = directory / "dlssnr-launcher-ack.tmp";
            {
                std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
                output.write(command.data(), command.size());
                output.close();
                if (!output) return;
            }
            const auto ack = directory / "dlssnr-launcher-ack.txt";
#ifdef _WIN32
            if (!MoveFileExW(temporary.c_str(), ack.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) return;
#else
            std::error_code error;
            std::filesystem::rename(temporary, ack, error);
            if (error) return;
#endif
            processed = id;
        } catch (...) {
            // A missing/unwritable command channel must never crash rendering.
        }
    }
};
} // namespace DlssNrLauncher
