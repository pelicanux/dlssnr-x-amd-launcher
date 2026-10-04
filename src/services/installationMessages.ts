import { translations, type Language } from "../i18n/translations";

export function isMissingModel(error: unknown): boolean {
  const text = String(error);
  return text.includes("MODEL_BIN_NOT_FOUND") || /Failed to copy bin file:.*(?:No such file or directory|os error 2)/i.test(text);
}

export function localizeInstallationMessage(message: string, language: Language): string {
  const target = translations[language].installation;
  const pt = translations.pt.installation;
  const replacements: [string, string][] = [
    ["MODEL_BIN_NOT_FOUND", target.missingModel],
    [pt.incompatibleTitle, target.incompatibleTitle],
    [pt.incompatibleBody, target.incompatibleBody],
    ["Arquivos do backend não encontrados! Clique no botão de Atualizar no topo direito para baixar os arquivos necessários.", target.backendMissing],
    ["Log completo:", target.fullLog],
    ["Failed to copy bin file:", target.copyBin],
    ["Failed to create temporary directory:", target.tempDirectory],
    ["Failed to extract bundled resources:", target.extractResources],
    ["Failed to execute cp command for extraction", target.extractCommand],
    ["Failed to execute bash process:", target.bashProcess],
    ["Script Error (code:", target.scriptError],
    ["Success:", target.success],
  ];
  return replacements.reduce((text, [source, translated]) => text.split(source).join(translated), message);
}
