// Presentation-only helpers. No auth/business logic lives here.

import type { Role } from '@/types/enums';

const ROLE_LABELS: Record<Role, string> = {
  FIELD_INSPECTOR: 'Field Inspector',
  MINE_OFFICIAL: 'Mine Official',
  CORPORATE_ADMIN: 'Corporate Admin',
  REGULATOR: 'Regulator',
};

export function formatRole(role: Role): string {
  return ROLE_LABELS[role];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Counts use Indian digit grouping (1,23,456), matching the backend's PDF
// compliance reports.
export function formatCount(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// "IN_PROGRESS" -> "In progress", "HIGH_AI_RISK" -> "High AI risk".
export function humanizeEnum(value: string): string {
  const s = value.replace(/_/g, ' ').toLowerCase().replace(/\bai\b/g, 'AI');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Compact relative time for activity feeds ("3d ago"). Input is an ISO
// timestamp straight from the API (createdAt / updatedAt).
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((Date.now() - then) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);

  const value =
    abs < 60
      ? 'just now'
      : abs < 3600
        ? `${Math.floor(abs / 60)}m`
        : abs < 86400
          ? `${Math.floor(abs / 3600)}h`
          : abs < 2592000
            ? `${Math.floor(abs / 86400)}d`
            : `${Math.floor(abs / 2592000)}mo`;

  if (value === 'just now') return value;
  return future ? `in ${value}` : `${value} ago`;
}

// Clock time for the "data as of" stamp on the dashboard.
export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
