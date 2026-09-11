import type { ReactNode } from 'react';
import { ago, sanitize } from '../format';

export function Icon({ name, size = 18 }: { name: 'arrow' | 'back' | 'refresh' | 'comment' | 'sun' | 'chevron' | 'book' | 'search'; size?: number }) {
  const paths = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    back: <><path d="m12 5-7 7 7 7M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.7-1L20 9M4 15l2.2 3A7 7 0 0 0 17.9 17" /></>,
    comment: <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L4 20l1.4-4A8 8 0 1 1 20 11.5Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    book: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" /><path d="M6 9h3m6 0h3M6 12h3m6 0h3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
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
