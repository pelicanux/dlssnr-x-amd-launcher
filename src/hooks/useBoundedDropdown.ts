import { useLayoutEffect, useState, type CSSProperties, type RefObject, type Dispatch, type SetStateAction } from "react";

// Render popups outside clipped panels, reserving the title bar and window edges.
export function useBoundedDropdown(
  isOpen: boolean,
  anchorRef: RefObject<HTMLDivElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  setIsOpen: Dispatch<SetStateAction<boolean>>,
) {
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const trigger = anchorRef.current?.querySelector(".custom-select-trigger");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const margin = 8, topLimit = 56;
      if (rect.bottom <= topLimit || rect.top >= window.innerHeight - margin) {
        setIsOpen(false);
        return;
      }
      const below = Math.max(0, window.innerHeight - rect.bottom - margin * 2);
      const above = Math.max(0, rect.top - topLimit - margin);
      const opensBelow = below >= 250 || below >= above;
      const width = Math.min(rect.width, window.innerWidth - margin * 2);
      setPosition({
        position: "fixed", width,
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
        top: opensBelow ? rect.bottom + margin : undefined,
        bottom: opensBelow ? "auto" : window.innerHeight - rect.top + margin,
        maxHeight: Math.min(250, opensBelow ? below : above), zIndex: 1100,
      });
    };
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    const scroll = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", scroll, true);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", scroll, true);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [isOpen, anchorRef, menuRef, setIsOpen]);
  return position;
}
