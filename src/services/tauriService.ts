import { open } from "@tauri-apps/plugin-dialog";

/**
 * Opens a file picker dialog using Tauri.
 * @param filterName Name of the filter (e.g. "DLL/ZIP")
 * @param extensions Allowed extensions (e.g. ["dll", "zip"])
 * @returns The selected file path, or null if canceled.
 */
export const openFilePicker = async (filterName: string, extensions: string[]): Promise<string | null> => {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: filterName, extensions }],
  });
  return selected ? (selected as string) : null;
};

/**
 * Opens a directory picker dialog using Tauri.
 * @param title Optional title for the dialog.
 * @returns The selected directory path, or null if canceled.
 */
export const openDirectoryPicker = async (title?: string): Promise<string | null> => {
  const selected = await open({
    multiple: false,
    directory: true,
    title,
  });
  return selected ? (selected as string) : null;
};
