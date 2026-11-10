import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

/* ---------- icons (stroke icons, 24px grid) ---------- */
const PATHS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  fleet: 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',
  log: 'M6 4h12v16H6zM9 9h6M9 13h6M9 17h3',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a7.6 7.6 0 000-2l2-1.5-2-3.5-2.3 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.4 3a7.6 7.6 0 00-1.7 1l-2.3-1-2 3.5 2 1.5a7.6 7.6 0 000 2l-2 1.5 2 3.5 2.3-1a7.6 7.6 0 001.7 1l.4 3h4l.4-3a7.6 7.6 0 001.7-1l2.3 1 2-3.5z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  out: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  plus: 'M12 5v14M5 12h14',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  print: 'M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  sms: 'M4 5h16v11H9l-5 4z',
};
export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- status badge ---------- */
export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`badge badge-${status}`}>{t(`status.${status}`)}</span>;
}

/* ---------- the "pipe rack" gauge: the product's signature element ----------
   One vertical bar per slice of the fleet, like stacked scaffolding tubes.
   parts: [{ value, tone }] with tone in site | yard | lost */
export function PipeGauge({ parts, cells = 40, height = 34 }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const raw = parts.map((p) => (p.value / total) * cells);
  const counts = raw.map(Math.floor);
  let rest = cells - counts.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (rest > 0) { counts[i] += 1; rest -= 1; } });
  const bars = [];
  parts.forEach((p, pi) => { for (let k = 0; k < counts[pi]; k++) bars.push(p.tone); });
  return (
    <div className="pipes" style={{ height }} role="img" aria-label={parts.map((p) => `${p.tone} ${p.value}`).join(', ')}>
      {bars.map((tone, i) => <span key={i} className={`pipe pipe-${tone}`} />)}
    </div>
  );
}

/* ---------- time-left ring for expiring contracts ---------- */
export function ExpiryRing({ progress, tone = 'amber', children, size = 58 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeDasharray={`${c * Math.min(1, progress)} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, wide }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current && ref.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><Icon name="x" /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, msg, tone }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((i) => <div key={i.id} className={`toast toast-${i.tone}`}>{i.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- data loading helper ---------- */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn().then((data) => setState({ data, error: null, loading: false })).catch((error) => setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export function ErrorNote({ error }) {
  const { err } = useI18n();
  if (!error) return null;
  return <div className="note note-error" role="alert"><Icon name="alert" /> <span>{err(error)}</span></div>;
}

export function Spinner() {
  const { t } = useI18n();
  return <div className="spinner">{t('common.loading')}</div>;
}
