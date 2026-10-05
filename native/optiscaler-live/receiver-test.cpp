// SPDX-License-Identifier: GPL-3.0-only
#include "LauncherControl.h"
#include <cassert>
#include <iostream>
#include <thread>

int main() {
    const auto root = std::filesystem::temp_directory_path() / ("opti-live-test-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
    std::filesystem::create_directories(root);
    DlssNrLauncher::Receiver receiver;
    bool enabled = true;
    unsigned changes = 0;
    auto apply = [&](bool value) { enabled = value; ++changes; return enabled == value; };
    auto write = [&](const std::string& text) {
        std::ofstream out(root / "dlssnr-launcher-command.txt", std::ios::binary | std::ios::trunc);
        out << text; out.close();
        std::this_thread::sleep_for(std::chrono::milliseconds(160));
    };
    const std::string off = "12345678-1234-1234-1234-123456789abc\n0\n";
    const std::string on = "12345678-1234-1234-1234-123456789abd\n1\n";
    write(off); receiver.Poll(root, apply);
    assert(!enabled && changes == 1);
    std::ifstream ack(root / "dlssnr-launcher-ack.txt", std::ios::binary);
    assert(std::string(std::istreambuf_iterator<char>(ack), {}) == off);
    enabled = true; // Manual checkbox change in game must remain in effect.
    write(off); receiver.Poll(root, apply);
    assert(enabled && changes == 1);
    write(on); receiver.Poll(root, apply);
    assert(enabled && changes == 2);
    write("12345678-1234-1234-1234-123456789abe\nX\n"); receiver.Poll(root, apply);
    write(on + "garbage"); receiver.Poll(root, apply);
    assert(changes == 2);
    write("12345678-1234-1234-1234-123456789abf\n0\n");
    receiver.Poll(root, [](bool) { return false; });
    std::ifstream last_ack(root / "dlssnr-launcher-ack.txt", std::ios::binary);
    assert(std::string(std::istreambuf_iterator<char>(last_ack), {}) == on);
    receiver.Poll(root / "missing", apply);
    std::filesystem::remove_all(root);
    std::cout << "OK: live state, acknowledgement, manual checkbox preserved, invalid commands rejected.\n";
}
