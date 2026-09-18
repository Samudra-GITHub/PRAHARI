// Static navigation config for the app shell's sidebar. `roles` mirrors the
// read-permissions already documented in backend/src/lib/rbac.ts's
// PERMISSIONS matrix (e.g. REPORT_READ is false for FIELD_INSPECTOR,
// AUDIT_READ is only true for CORPORATE_ADMIN/REGULATOR) — this is
// presentation-only filtering of which nav entries make sense for a role;
// the backend independently enforces the real access control on every
// request regardless of what the sidebar shows.
//
// Every entry other than "Dashboard" is `disabled` because the pages don't
// exist yet (Step 2/3 are auth + shell + Command Center only) — they're
// listed so the shell communicates the app's shape without linking anywhere
// real yet.

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  Mountain,
  ShieldAlert,
  Bell,
  FileText,
  ScrollText,
  BrainCircuit,
  Bot,
} from 'lucide-react';
import type { Role } from '@/types/enums';

export type NavSection = 'Overview' | 'Operations' | 'Governance';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  // Omitted = visible to every role.
  roles?: Role[];
  disabled?: boolean;
};

export const NAV_SECTIONS: NavSection[] = ['Overview', 'Operations', 'Governance'];

export const NAV_ITEMS: NavItem[] = [
  { label: 'Command Center', href: '/', icon: LayoutDashboard, section: 'Overview' },
  // Backed by POST /api/copilot/chat (backend/src/app/api/copilot/chat) —
  // real RBAC-scoped retrieval + Groq-generated, grounded answers. Open to
  // every role since each one already has read access to *something*
  // (their own mine, their own inspections, or the full portfolio) — the
  // backend enforces exactly the same scoping Copilot's answers can draw on.
  { label: 'AI Copilot', href: '/copilot', icon: Bot, section: 'Overview' },

  { label: 'Mines', href: '/mines', icon: Mountain, section: 'Operations', disabled: true },
  { label: 'Inspections', href: '/inspections', icon: ClipboardList, section: 'Operations', disabled: true },
  { label: 'Violations', href: '/violations', icon: ShieldAlert, section: 'Operations', disabled: true },
  { label: 'Alerts', href: '/alerts', icon: Bell, section: 'Operations', disabled: true },

  {
    label: 'Reports',
    href: '/reports',
    icon: FileText,
    section: 'Governance',
    roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'],
    disabled: true,
  },
  {
    label: 'AI Risk',
    href: '/ai-risk',
    icon: BrainCircuit,
    section: 'Governance',
    roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'],
    disabled: true,
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: ScrollText,
    section: 'Governance',
    roles: ['CORPORATE_ADMIN', 'REGULATOR'],
    disabled: true,
  },
];
