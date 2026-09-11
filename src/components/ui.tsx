import { useState, type ReactNode } from 'react';
import { ago, domain, faviconUrl, sanitize } from '../format';

export function Icon({ name, size = 18 }: { name: 'arrow' | 'back' | 'refresh' | 'comment' | 'sun' | 'chevron' | 'book' | 'search' | 'archive' | 'star' | 'reader' | 'embed' | 'help' | 'sliders' | 'focus'; size?: number }) {
  const paths = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    back: <><path d="m12 5-7 7 7 7M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.7-1L20 9M4 15l2.2 3A7 7 0 0 0 17.9 17" /></>,
    comment: <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L4 20l1.4-4A8 8 0 1 1 20 11.5Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    book: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" /><path d="M6 9h3m6 0h3M6 12h3m6 0h3" /></>,
    archive: <><path d="M3 7h18v3H3zM5 10v9h14v-9" /><path d="M10 14h4" /></>,
    star: <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8Z" />,
    reader: <><path d="M4 5h16v14H4z" /><path d="M7 9h10M7 12.5h10M7 16h6" /></>,
    embed: <><path d="M3 5h18v14H3z" /><path d="M3 9h18" /><path d="M6 7h.01M9 7h.01" /></>,
    sliders: <><path d="M4 7h10m4 0h2M4 17h4m4 0h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
    focus: <><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-.7.7-.7 1.3v.3" /><path d="M12 17h.01" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
// The monogram sits underneath the icon, so a slow or missing favicon still
// leaves the tile readable.
export function Favicon({ url, fallback = '?', className = '' }: { url?: string; fallback?: string; className?: string }) {
  const host = domain(url);
  const [broken, setBroken] = useState(false);
  return <span className={`favicon ${className}`} aria-hidden="true">
    {(host || fallback).charAt(0).toUpperCase()}
    {host && !broken && <img src={faviconUrl(host)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />}
  </span>;
}
export function HideReadToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return <label className="hide-read"><input type="checkbox" checked={on} onChange={event => onChange(event.target.checked)} />Hide read</label>;
}
export function SaveButton({ saved, onToggle, title, className = '' }: { saved: boolean; onToggle: () => void; title: string; className?: string }) {
  return <button type="button" className={`save-button ${saved ? 'is-saved' : ''} ${className}`} aria-pressed={saved}
    aria-label={`${saved ? 'Remove' : 'Save'} ${title}`} title={saved ? 'Remove from saved' : 'Save story'}
    onClick={event => { event.preventDefault(); event.stopPropagation(); onToggle(); }}><Icon name="star" size={14} /></button>;
}
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span></a>;
}
export function Author({ name }: { name?: string }) {
  return name ? <ExternalLink href={`https://news.ycombinator.com/user?id=${encodeURIComponent(name)}`}>{name}</ExternalLink> : <span>unknown author</span>;
}
export function Time({ value }: { value?: number }) {
  return <time dateTime={value ? new Date(value * 1000).toISOString() : undefined} title={value ? new Date(value * 1000).toLocaleString() : undefined}>{ago(value)}</time>;
}
export function RichText({ text }: { text: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: sanitize(text) }} />;
}
export function Failure({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return <div className="failure" role="alert"><span>{children}</span>{retry && <button className="text-button" onClick={retry}>Try again <Icon name="refresh" size={14} /></button>}</div>;
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeletons" role="status" aria-label="Loading"><span className="sr-only">Loading…</span>{Array.from({ length: rows }, (_, i) => <div className="skeleton" key={i}><i /><i /><i /></div>)}</div>;
}
