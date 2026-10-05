export function isInstalledMod(status?: string): boolean {
  return !!status && /^(?:OptiScaler|ReShade|Vulkan\/DX9|Instalado \((?:OptiScaler|ReShade|Vulkan\/DX9)\))$/.test(status);
}
