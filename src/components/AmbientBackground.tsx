import { useEffect, useRef } from "react";
import { prepareAmbientCover } from "../services/ambientCoverCache";

// One small canvas keeps the current blend, even when a transition is interrupted.
export function AmbientBackground({ coverUrl }: { coverUrl?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let cancelled = false;
    let frame = 0;
    const blendTo = (image?: HTMLCanvasElement) => {
      if (cancelled) return;
      const previous = document.createElement("canvas");
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext("2d")?.drawImage(canvas, 0, 0);
      const target = document.createElement("canvas");
      target.width = canvas.width;
      target.height = canvas.height;
      if (image) target.getContext("2d")?.drawImage(image, 0, 0);
      const started = performance.now();
      const draw = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - started) / 900);
        const eased = progress * progress * (3 - 2 * progress);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.globalAlpha = 1 - eased;
        context.drawImage(previous, 0, 0);
        // Add premultiplied colors so an opaque-to-opaque blend does not darken midway.
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = eased;
        context.drawImage(target, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        if (progress < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };
    if (coverUrl) {
      void prepareAmbientCover(coverUrl).then(image => blendTo(image));
    } else blendTo();
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [coverUrl]);
  return <canvas ref={canvasRef} className="ambient-background" width={320} height={180} aria-hidden="true" />;
}
