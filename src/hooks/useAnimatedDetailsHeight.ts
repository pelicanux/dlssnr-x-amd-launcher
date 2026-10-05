import { useLayoutEffect, useRef, useState } from "react";

// Measure intrinsic content, not the animated shell: observing the shell would feed
// its intermediate heights back into the animation and prevent it from settling.
export function useAnimatedDetailsHeight(gamePath: string | undefined, performanceMode: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [resizing, setResizing] = useState(false);
  const measuredHeight = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!gamePath || !content) return;
    const measure = () => {
      const next = content.offsetHeight;
      if (measuredHeight.current === next) return;
      measuredHeight.current = next;
      setResizing(!performanceMode);
      setHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [gamePath, performanceMode]);

  return { contentRef, height, resizing, startResize: () => setResizing(!performanceMode), finishResize: () => setResizing(false) };
}
