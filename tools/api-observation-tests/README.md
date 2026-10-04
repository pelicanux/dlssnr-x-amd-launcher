# API observation tests

Run the production detector and cache tests without Tauri/GTK:

```sh
cargo test --manifest-path tools/api-observation-tests/Cargo.toml
```

The panel reads one small observation cache file immediately, then observes the
selected game's running processes every five seconds while the document is visible.
There is no recursive game-directory scan, import parsing, catalog request, or game
launch on the information-panel path. Old heuristic caches are not reused.

Open a game normally and select it in the panel. Observations identify native games
by their executable path and Wine games by a mapped PE executable inside the selected
game directory. Only headers and `/proc` are read. Helpers and launchers are excluded.
Close the game: the next poll should label the saved result as a past observation.
Switch games during a poll: results for the previous game must not update the panel.

Loaded modules are evidence, not proof of the active renderer. Multiple APIs remain
ambiguous. On Wine, native Vulkan/OpenGL modules are excluded because they can belong
to translation layers. Unobserved games show “Not identified”; platform/architecture
also become available on observation. Running in a container with a different PID
namespace or restricted `/proc` may prevent observation of host games. Building in a
container and running the resulting app on the host does not cause that restriction.

The process pass checks a 200 ms budget between processes, at most 4096 process
entries, 64 maps files, 2 MiB per maps file, and 8 MiB total. These are work limits,
not a hard deadline for a filesystem operation already in progress. Only one process
scan runs at a time. Cache reads are limited to 32 KiB; unchanged observations are
persisted at most once per minute. The cache stores historical evidence, so it does
not traverse the game directory to invalidate it.
