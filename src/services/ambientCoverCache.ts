// Prepare small background images once, away from the selection animation.
const covers = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<HTMLCanvasElement | undefined>>();
const WIDTH = 320;
const HEIGHT = 180;

export function prepareAmbientCover(url: string, loadedImage?: HTMLImageElement): Promise<HTMLCanvasElement | undefined> {
  const cached = covers.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(url);
  if (existing) return existing;
  const task = (async () => {
    const image = loadedImage ?? new Image();
    if (!loadedImage) image.src = url;
    try {
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) return undefined;
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      canvas.getContext("2d")?.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
      // Bound memory usage when rescanning or browsing a large library.
      if (covers.size >= 64) covers.delete(covers.keys().next().value!);
      covers.set(url, canvas);
      return canvas;
    } catch { return undefined; }
    finally { pending.delete(url); }
  })();
  pending.set(url, task);
  return task;
}

export function warmAmbientCover(url: string, image: HTMLImageElement) {
  if (covers.has(url) || pending.has(url)) return;
  // Give visible covers a chance to paint before preparing their backgrounds.
  if ("requestIdleCallback" in window) window.requestIdleCallback(() => { void prepareAmbientCover(url, image); }, { timeout: 1500 });
  else setTimeout(() => { void prepareAmbientCover(url, image); }, 0);
}
