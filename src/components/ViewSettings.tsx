import { useEffect, useRef } from 'react';
import type { Settings } from '../settings';

const widths: [Settings['width'], string][] = [['comfortable', 'Comfortable'], ['wide', 'Wide'], ['full', 'Full']];
const orders: [Settings['order'], string][] = [['comments-first', 'Comments'], ['article-first', 'Article']];
const densities: [Settings['density'], string][] = [['comfortable', 'Comfortable'], ['compact', 'Compact']];
const intervals: Settings['refresh'][] = [0, 1, 5, 15];

function Choice<T extends string>({ label, hint, value, options, onChange, className = '' }: {
  label: string; hint: string; value: T; options: [T, string][]; onChange: (value: T) => void; className?: string;
}) {
  return <div className={`setting ${className}`}>
    <div><span className="setting-label">{label}</span><span className="setting-hint">{hint}</span></div>
    <div className="mode-switch" role="group" aria-label={label}>
      {options.map(([option, text]) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{text}</button>)}
    </div>
  </div>;
}

export default function ViewSettings({ open, settings, onChange, onClose, onShortcuts }: {
  open: boolean; settings: Settings; onChange: (patch: Partial<Settings>) => void; onClose: () => void; onShortcuts: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return <dialog className="sheet view-settings" ref={dialog} aria-labelledby="view-settings-title" onClose={onClose}
    onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="sheet-inner">
      <h2 id="view-settings-title">View settings</h2>
      <Choice className="wide-only" label="Width" hint="How much of the screen the reader uses." value={settings.width} options={widths} onChange={width => onChange({ width })} />
      <Choice className="wide-only" label="Middle column" hint="Which pane sits beside the story list." value={settings.order} options={orders} onChange={order => onChange({ order })} />
      <Choice label="Density" hint="Spacing in lists and conversations." value={settings.density} options={densities} onChange={density => onChange({ density })} />
      <div className="setting">
        <div><span className="setting-label">Feed heading</span><span className="setting-hint">The title above each list. Hiding it moves refresh to the top bar.</span></div>
        <label className="hide-read"><input type="checkbox" checked={settings.heading} onChange={event => onChange({ heading: event.target.checked })} />Show</label>
      </div>
      <div className="setting">
        <div><span className="setting-label">Auto-refresh</span><span className="setting-hint">Checks for new stories, and offers them when you are ready.</span></div>
        <select aria-label="Auto-refresh interval" value={settings.refresh} onChange={event => onChange({ refresh: Number(event.target.value) as Settings['refresh'] })}>
          {intervals.map(value => <option key={value} value={value}>{value ? `Every ${value} min` : 'Off'}</option>)}
        </select>
      </div>
      <div className="sheet-actions">
        <button type="button" className="text-button" onClick={onShortcuts}>Keyboard shortcuts</button>
        <button type="button" className="secondary-button" onClick={onClose}>Close <kbd>Esc</kbd></button>
      </div>
    </div>
  </dialog>;
}
