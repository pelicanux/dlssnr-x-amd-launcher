export function defaultShortcutForRoute(route?: string): string {
  return route === "reshade" || route === "vulkan" || route === "dx9" ? "Home" : "Insert";
}

export function steamLaunchOptionsForRoute(route: string): string {
  const overrides = route === "vulkan" || route === "dx9"
    ? "winevulkan=n,b;vulkan-1=n,b"
    : "dxgi=n,b";
  return `WINEDLLOVERRIDES="${overrides}" %command%`;
}
