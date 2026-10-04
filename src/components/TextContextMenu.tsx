import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n/I18nContext";

type Field = HTMLInputElement | HTMLTextAreaElement;
type Context = { x: number; y: number; text: string; field: Field | null; editable: HTMLElement | null; range: Range | null; start: number; end: number };

export function TextContextMenu() {
  const { t } = useI18n();
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = (event: MouseEvent) => {
      setContext(null); setError(false);
      const target = event.target instanceof Element ? event.target : null;
      // The cover owns its menu even when text elsewhere remains selected.
      if (!target || target.closest('.library-cover-thumbnail, .selected-cover')) return;
      const field = target.closest('input, textarea') as Field | null;
      const editable = target.closest('[contenteditable="true"]') as HTMLElement | null;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const start = field?.selectionStart ?? 0;
      const end = field?.selectionEnd ?? start;
      const text = field ? field.type === 'password' ? '' : field.value.slice(start, end) : selection?.toString() ?? '';
      const onSelection = !!range && Array.from(range.getClientRects()).some(rect => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
      if (!field && !editable && (!text || !onSelection)) return;
      event.preventDefault(); event.stopPropagation();
      setContext({ x: event.clientX, y: event.clientY, text, field, editable, range, start, end });
    };
    const close = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setContext(null); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setContext(null); };
    document.addEventListener('contextmenu', open, true);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('contextmenu', open, true);
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!context || !menuRef.current) return;
    const menu = menuRef.current;
    menu.style.left = `${Math.max(8, Math.min(context.x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(context.y, window.innerHeight - menu.offsetHeight - 8))}px`;
  }, [context, error]);

  const canPaste = context && (context.field ? !context.field.readOnly && !context.field.disabled && context.field.selectionStart !== null : !!context.editable);
  const action = async (paste: boolean) => {
    if (!context || busy) return;
    setBusy(true); setError(false);
    try {
      if (!paste) {
        await invoke('plugin:clipboard-manager|write_text', { text: context.text });
      } else {
        const text = await invoke<string>('plugin:clipboard-manager|read_text');
        if (context.field?.isConnected) {
          const field = context.field;
          field.focus();
          const value = field.value.slice(0, context.start) + text + field.value.slice(context.end);
          // Use the native setter so React's controlled inputs observe the change.
          const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.setSelectionRange(context.start + text.length, context.start + text.length);
        } else if (context.editable?.isConnected && context.range && context.editable.contains(context.range.commonAncestorContainer)) {
          const range = context.range;
          context.editable.focus();
          range.deleteContents();
          const node = document.createTextNode(text);
          range.insertNode(node); range.setStartAfter(node); range.collapse(true);
          const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
          context.editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: text }));
        }
      }
      setContext(null);
    } catch (error) { console.error('Clipboard operation failed:', error); setError(true); }
    finally { setBusy(false); }
  };

  return context && createPortal(
    <div ref={menuRef} className="text-context-menu" role="menu" aria-label={t('textContext', 'title')}
      style={{ left: context.x, top: context.y }} onMouseDown={event => event.preventDefault()} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
      <button role="menuitem" disabled={!context.text || busy} onClick={() => void action(false)}>{t('textContext', 'copy')}</button>
      <button role="menuitem" disabled={!canPaste || busy} onClick={() => void action(true)}>{t('textContext', 'paste')}</button>
      {error && <p role="alert">{t('textContext', 'error')}</p>}
    </div>, document.body
  );
}
