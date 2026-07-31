import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Bell,
  Check,
  ChevronDown,
  LogIn,
  LogOut,
  MessageSquare,
  Mountain,
  Settings,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { THEMES, useTheme } from '@/app/theme';
import { useCurrentUser, useLogout } from '@/features/auth/api';
import { useMarkAllRead, useNotifications } from '@/features/notifications/api';

type MenuId = 'theme' | 'notifications' | 'messages' | 'profile';

/** Top bar: brand (mobile only) + theme selector, notifications, messages, profile.
 * All menus are UI-only for now — the backend (notifications, DMs, friends, auth)
 * plugs into these panels later. */
export function TopBar() {
  const [open, setOpen] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close any open menu when clicking/tapping outside the bar or pressing Escape.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const toggle = (id: MenuId) => setOpen((current) => (current === id ? null : id));

  return (
    <header
      ref={barRef}
      // relative z-40 lifts the whole bar (and its dropdown panels) above the
      // page content — backdrop-blur alone creates a stacking context that
      // would otherwise paint BELOW positioned elements in <main>.
      className="relative z-40 flex items-center justify-between gap-3 border-b border-line bg-surface/70 px-4 py-2.5 backdrop-blur-sm md:justify-end"
    >
      {/* Brand — mobile only (desktop shows it in the sidebar) */}
      <div className="flex items-center gap-2.5 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-accent to-accent-2 text-accent-ink">
          <Mountain size={15} aria-hidden />
        </span>
        <span className="font-display font-bold tracking-tight">Arcadia Atlas</span>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeMenu open={open === 'theme'} onToggle={() => toggle('theme')} />
        <NotificationsMenu
          open={open === 'notifications'}
          onToggle={() => toggle('notifications')}
        />
        <MessagesMenu open={open === 'messages'} onToggle={() => toggle('messages')} />
        <ProfileMenu open={open === 'profile'} onToggle={() => toggle('profile')} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function IconButton({
  label,
  open,
  onClick,
  badge,
  children,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
        open ? 'bg-elev text-ink' : 'text-muted hover:bg-elev hover:text-ink'
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
          {badge}
        </span>
      )}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl shadow-black/10">
      <p className="px-2.5 pt-1.5 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyState({ Icon, title, hint }: { Icon: typeof Bell; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elev text-muted">
        <Icon size={18} strokeWidth={1.8} aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function MenuItem({
  Icon,
  label,
  hint,
}: {
  Icon: typeof User;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-elev"
    >
      <Icon size={16} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Menus                                                               */
/* ------------------------------------------------------------------ */

function ThemeMenu({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Select theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 transition-colors ${
          open ? 'bg-elev text-ink' : 'text-muted hover:bg-elev hover:text-ink'
        }`}
      >
        <span
          className="h-4 w-4 rounded-full border border-line"
          style={{
            background: `linear-gradient(135deg, ${current.swatch[0]} 50%, ${current.swatch[1]} 50%)`,
          }}
        />
        <ChevronDown size={14} aria-hidden />
      </button>

      {open && (
        <Panel title="Theme">
          {THEMES.map(({ id, label, mode, swatch: [bg, accent] }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-elev ${
                theme === id ? 'font-semibold' : ''
              }`}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border border-line"
                style={{ background: `linear-gradient(135deg, ${bg} 50%, ${accent} 50%)` }}
              />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-muted capitalize">{mode}</span>
              {theme === id && <Check size={15} className="text-accent" aria-hidden />}
            </button>
          ))}
        </Panel>
      )}
    </div>
  );
}

function NotificationsMenu({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data: user } = useCurrentUser();
  const notifications = useNotifications(Boolean(user));
  const markAllRead = useMarkAllRead();

  return (
    <div className="relative">
      <IconButton
        label="Notifications"
        open={open}
        onClick={onToggle}
        badge={notifications.data?.unread ?? 0}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden />
      </IconButton>
      {open && (
        <Panel title="Notifications">
          {!user && (
            <EmptyState
              Icon={Bell}
              title="Sign in for notifications"
              hint="Activity and community updates will show up here."
            />
          )}
          {user && notifications.data?.notifications.length === 0 && (
            <EmptyState Icon={Bell} title="All caught up" hint="Nothing new right now." />
          )}
          {notifications.data?.notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-elev"
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  n.read ? 'bg-elev text-muted' : 'bg-accent-soft text-accent'
                }`}
              >
                <Sparkles size={15} strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className={`text-sm ${n.read ? 'font-normal text-muted' : 'font-medium'}`}>
                  {n.title}
                </p>
                {n.body && <p className="text-xs text-muted">{n.body}</p>}
              </div>
            </div>
          ))}
          {(notifications.data?.unread ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="mt-1 w-full rounded-xl px-2.5 py-2 text-left text-xs font-medium text-accent transition-colors hover:bg-elev"
            >
              Mark all as read
            </button>
          )}
        </Panel>
      )}
    </div>
  );
}

function MessagesMenu({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <IconButton label="Messages" open={open} onClick={onToggle}>
        <MessageSquare size={18} strokeWidth={1.8} aria-hidden />
      </IconButton>
      {open && (
        <Panel title="Messages">
          <EmptyState
            Icon={MessageSquare}
            title="No messages yet"
            hint="Direct messages with friends will show up here."
          />
        </Panel>
      )}
    </div>
  );
}

function ProfileMenu({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Profile"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={`ml-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm transition-transform hover:scale-105 ${
          open ? 'ring-2 ring-accent/40' : ''
        }`}
      >
        {user ? (
          <span className="text-sm font-bold uppercase">{user.username.charAt(0)}</span>
        ) : (
          <User size={17} strokeWidth={2} aria-hidden />
        )}
      </button>

      {open && (
        <Panel title="Account">
          <div className="mb-1 flex items-center gap-3 rounded-xl bg-elev px-2.5 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-2 text-accent-ink">
              {user ? (
                <span className="text-sm font-bold uppercase">{user.username.charAt(0)}</span>
              ) : (
                <User size={16} aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.username ?? 'Guest athlete'}</p>
              <p className="truncate text-xs text-muted">{user?.email ?? 'Not signed in'}</p>
            </div>
          </div>
          {user ? (
            <>
              <MenuItem Icon={User} label="Profile" hint="Soon" />
              <MenuItem Icon={Users} label="Friends" hint="Soon" />
              <Link
                to="/settings"
                onClick={onToggle}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-elev"
              >
                <Settings size={16} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
                Settings
              </Link>
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                onClick={() => {
                  logout.mutate();
                  onToggle();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-elev"
              >
                <LogOut size={16} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/signin"
              onClick={onToggle}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-elev"
            >
              <LogIn size={16} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
              Sign in
            </Link>
          )}
        </Panel>
      )}
    </div>
  );
}
