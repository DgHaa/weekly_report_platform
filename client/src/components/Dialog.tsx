import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';

type ConfirmOpts = { title?: string; message: string; confirmText?: string; danger?: boolean };
type PromptOpts = { title?: string; message?: string; placeholder?: string; initial?: string; allowEmpty?: boolean };

type DialogState =
  | { kind: 'confirm'; title: string; message: string; confirmText: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; message: string; placeholder: string; initial: string; allowEmpty: boolean; resolve: (v: string | null) => void }
  | null;

interface DialogApi {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
}

const DialogCtx = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const c = useContext(DialogCtx);
  if (!c) throw new Error('DialogProvider missing');
  return c;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const stateRef = useRef<DialogState>(null);
  stateRef.current = state;

  const confirm = useCallback((opts: ConfirmOpts) =>
    new Promise<boolean>((resolve) => {
      setState({ kind: 'confirm', title: opts.title || '确认操作', message: opts.message, confirmText: opts.confirmText || '确定', danger: !!opts.danger, resolve });
    }), []);

  const prompt = useCallback((opts: PromptOpts) =>
    new Promise<string | null>((resolve) => {
      setState({ kind: 'prompt', title: opts.title || '请输入', message: opts.message || '', placeholder: opts.placeholder || '', initial: opts.initial || '', allowEmpty: !!opts.allowEmpty, resolve });
    }), []);

  const close = useCallback((val: any) => {
    const s = stateRef.current;
    if (s) { s.resolve(val); setState(null); }
  }, []);

  return (
    <DialogCtx.Provider value={{ confirm, prompt }}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => close(state.kind === 'prompt' ? null : false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {state.kind === 'confirm' ? (
              <>
                <div className="modal-title">{state.title}</div>
                <div className="modal-msg">{state.message}</div>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => close(false)}>取消</button>
                  <button className={state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state.confirmText}</button>
                </div>
              </>
            ) : (
              <PromptBody state={state} onSubmit={(v) => close(v)} onCancel={() => close(null)} />
            )}
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}

function PromptBody({ state, onSubmit, onCancel }: { state: Extract<DialogState, { kind: 'prompt' }>; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(state.initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const submit = () => {
    if (!state.allowEmpty && !val.trim()) return;
    onSubmit(val.trim());
  };
  return (
    <>
      <div className="modal-title">{state.title}</div>
      {state.message && <div className="modal-msg">{state.message}</div>}
      <input
        ref={inputRef}
        className="modal-input"
        value={val}
        placeholder={state.placeholder}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="modal-actions">
        <button className="ghost" onClick={onCancel}>取消</button>
        <button className="primary" onClick={submit} disabled={!state.allowEmpty && !val.trim()}>确定</button>
      </div>
    </>
  );
}
