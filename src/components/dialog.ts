// Modal built on native <dialog> (focus trap, Esc, inert background come from the browser).
import { h, type Child } from '../lib/dom';

export type DialogHandle = {
  el: HTMLDialogElement;
  body: HTMLElement;
  close: () => void;
  setError: (message: string | null) => void;
};

export type DialogOptions = {
  title: string;
  description?: Child;
  body?: Child;
  /** The safe button receives focus first (docs/design/admin.md section 4). */
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Return a promise; the dialog shows "Working..." and stays open on rejection. */
  onConfirm: (dialog: DialogHandle) => Promise<void>;
  onClose?: () => void;
};

export function openDialog(opts: DialogOptions, returnFocusTo?: HTMLElement | null): DialogHandle {
  const titleId = `dlg-t-${Math.random().toString(36).slice(2, 8)}`;
  const descId = `dlg-d-${Math.random().toString(36).slice(2, 8)}`;
  const errorBox = h('p', { class: 'alert alert-error', role: 'alert', hidden: true });
  const body = h('div', null, opts.body);
  const cancel = h('button', { type: 'button', class: 'btn btn-secondary' }, opts.cancelLabel);
  const confirm = h('button', { type: 'button', class: `btn ${opts.destructive ? 'btn-danger' : 'btn-primary'}` }, opts.confirmLabel);
  const el = h(
    'dialog',
    { class: 'dialog', role: 'alertdialog', 'aria-labelledby': titleId, 'aria-describedby': descId },
    h('h2', { id: titleId }, opts.title),
    h('div', { id: descId }, opts.description),
    body,
    errorBox,
    h('div', { class: 'btn-row' }, cancel, confirm),
  );

  const handle: DialogHandle = {
    el,
    body,
    close() {
      if (el.open) el.close();
    },
    setError(message) {
      errorBox.textContent = message ?? '';
      errorBox.hidden = !message;
    },
  };

  let busy = false;
  el.addEventListener('close', () => {
    el.remove();
    opts.onClose?.();
    returnFocusTo?.focus();
  });
  el.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
  cancel.addEventListener('click', () => { if (!busy) handle.close(); });
  confirm.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    handle.setError(null);
    const original = opts.confirmLabel;
    confirm.textContent = 'Working...';
    confirm.setAttribute('aria-disabled', 'true');
    try {
      await opts.onConfirm(handle);
    } catch {
      // onConfirm reports its own failure through handle.setError; keep the dialog open.
    } finally {
      busy = false;
      confirm.textContent = original;
      confirm.removeAttribute('aria-disabled');
    }
  });

  document.body.append(el);
  el.showModal();
  cancel.focus();
  return handle;
}
