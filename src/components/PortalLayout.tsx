import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  category: string;
  is_read: number;
  created_at: string;
}

interface PortalLayoutProps {
  portalTitle: string;
  portalSubtitle: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  primaryAction?: ReactNode;
  headerMeta?: ReactNode;
  collapsible?: boolean;
  theme?: 'glass' | 'observatory' | 'hospital';
  children: ReactNode;
}

export function PortalLayout({
  portalTitle,
  portalSubtitle,
  navItems,
  activeTab,
  onTabChange,
  primaryAction,
  headerMeta,
  collapsible = false,
  theme = 'glass',
  children,
}: PortalLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isObs = theme === 'observatory';
  const isHosp = theme === 'hospital';

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Ignore transient errors
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 20000);
    return () => clearInterval(timer);
  }, []);

  const handleMarkAllRead = async () => {
    await api.post('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleMarkOneRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const activeNav = navItems.find((i) => i.id === activeTab);
  const hasNotificationsTab = navItems.some((i) => i.id === 'notifications');

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isNarrow = collapsible && collapsed && !isMobile;
    return (
      <div
        className={`flex flex-col h-full p-3.5 gap-4 ${
          isHosp
            ? 'bg-white border-r border-[#E5E7EB] text-[#202124]'
            : isObs
              ? 'bg-[#12124d] border-r border-white/10 text-white'
              : 'bg-white/80 backdrop-blur-2xl border-r border-black/[0.07]'
        }`}
      >
        <div className={`px-2 pt-1 flex items-start justify-between gap-2 ${isNarrow ? 'justify-center px-0' : ''}`}>
          <div className="min-w-0">
            <Link
              to="/"
              className={`inline-flex items-center gap-2.5 text-[18px] font-semibold tracking-tight ${
                isObs ? 'text-white' : isHosp ? 'text-[#16165c]' : 'text-[#1d1d1f]'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isHosp
                    ? 'bg-[#16165c]'
                    : isObs
                      ? 'bg-[#5350cc] border border-[#00b1ff]/40'
                      : 'bg-[#1d1d1f]'
                }`}
              >
                <Activity className={`w-4 h-4 ${isObs || isHosp ? 'text-[#00ffaa]' : 'text-white'}`} />
              </span>
              {!isNarrow && <span>CareOne</span>}
            </Link>
            {!isNarrow && (
              <>
                <p
                  className={`text-[12px] font-semibold mt-2.5 truncate ${
                    isHosp ? 'text-[#202124]' : isObs ? 'text-[#b0b3d6]' : 'text-[#6e6e73]'
                  }`}
                >
                  {portalSubtitle || portalTitle}
                </p>
                {isHosp && (
                  <p className="text-[11px] text-[#777D87] truncate">Multi-Specialty Clinical Hospital</p>
                )}
                {!isHosp && portalSubtitle && (
                  <p className={`text-[11px] font-mono-tabular truncate ${isObs ? 'text-[#00b1ff]' : 'text-[#86868b]'}`}>
                    {portalTitle}
                  </p>
                )}
              </>
            )}
          </div>

          {collapsible && !isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-md text-[#777D87] hover:text-[#202124] hover:bg-[#F1F3F6] transition-colors shrink-0"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto pr-0.5" aria-label="Portal Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                title={isNarrow ? item.label : undefined}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center ${isNarrow ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2 rounded-lg text-[13px] font-medium transition-colors text-left whitespace-nowrap ${
                  isHosp
                    ? isActive
                      ? 'bg-[#16165c] text-white'
                      : 'text-[#777D87] hover:text-[#202124] hover:bg-[#F1F3F6]'
                    : isObs
                      ? isActive
                        ? 'bg-[#5350cc] text-white shadow-[0_6px_18px_rgba(83,80,204,0.4)] border border-[#00b1ff]/40'
                        : 'text-[#b0b3d6] hover:text-white hover:bg-[#232269] border border-transparent'
                      : isActive
                        ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-black/[0.06]'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.035] border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isHosp
                      ? isActive
                        ? 'text-[#00b1ff]'
                        : 'text-[#777D87]'
                      : isObs
                        ? isActive
                          ? 'text-[#00ffaa]'
                          : 'text-[#8f93c4]'
                        : isActive
                          ? 'text-[#0071e3]'
                          : 'text-[#86868b]'
                  }`}
                />
                {!isNarrow && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div
          className={`p-3 space-y-2.5 ${
            isHosp
              ? 'bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg'
              : isObs
                ? 'bg-[#232269] border border-white/10 rounded-xl'
                : 'glass-surface-inset'
          }`}
        >
          {!isNarrow && (
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold truncate ${isObs ? 'text-white' : 'text-[#202124]'}`}>
                {user?.full_name}
              </p>
              <p className={`text-[11px] truncate ${isObs ? 'text-[#b0b3d6]' : 'text-[#777D87]'}`}>{user?.email}</p>
            </div>
          )}
          <button
            type="button"
            title="Sign Out"
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[12px] ${
              isHosp ? 'hosp-btn-secondary' : isObs ? 'obs-btn-secondary' : 'mac-btn-secondary'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isNarrow && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex ${
        isHosp
          ? 'hosp-shell'
          : isObs
            ? 'bg-[#16165c] text-white'
            : 'bg-[#f5f5f7] text-[#1d1d1f]'
      }`}
    >
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-[width] duration-150 ${
          collapsible && collapsed ? 'w-[72px]' : isHosp ? 'w-60' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full">
            <SidebarContent isMobile />
          </div>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            className={`flex-1 backdrop-blur-xs ${isObs ? 'bg-black/50' : 'bg-black/25'}`}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className={`sticky top-0 z-30 h-15 px-4 sm:px-7 flex items-center justify-between gap-4 ${
            isHosp
              ? 'bg-white border-b border-[#E5E7EB]'
              : isObs
                ? 'bg-[#16165c]/90 backdrop-blur-xl border-b border-white/10'
                : 'bg-white/75 backdrop-blur-xl border-b border-black/[0.06]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={`lg:hidden p-2 ${
                isHosp ? 'hosp-btn-secondary' : isObs ? 'obs-btn-secondary' : 'mac-btn-secondary'
              }`}
              aria-label="Open navigation menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div
              className={`flex items-center gap-2 text-[13px] truncate ${
                isHosp ? 'text-[#777D87]' : isObs ? 'text-[#b0b3d6]' : 'text-[#86868b]'
              }`}
            >
              <span className={`hidden sm:inline font-medium ${isObs ? 'text-white' : 'text-[#202124]'}`}>CareOne</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="hidden md:inline truncate">{portalSubtitle || portalTitle}</span>
              <span className="hidden md:inline" aria-hidden="true">/</span>
              <span className={`font-semibold truncate ${isObs ? 'text-[#00b1ff]' : 'text-[#16165c]'}`}>
                {activeNav?.label || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 relative">
            {headerMeta}
            {primaryAction}

            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                if (!notifOpen) loadNotifications();
              }}
              className={`relative p-2 ${
                isHosp ? 'hosp-btn-secondary' : isObs ? 'obs-btn-secondary' : 'mac-btn-secondary'
              }`}
              aria-label="Notifications"
            >
              <Bell className={`w-4 h-4 ${isObs ? 'text-white' : 'text-[#202124]'}`} />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-semibold font-mono-tabular flex items-center justify-center ${
                    isHosp
                      ? 'bg-[#5350cc] text-white'
                      : isObs
                        ? 'bg-[#00b1ff] text-[#16165c]'
                        : 'bg-[#0071e3] text-white'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {isHosp && (
              <button
                type="button"
                onClick={() => onTabChange('settings')}
                className="hidden sm:inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] hover:bg-[#F1F3F6] text-[12px] font-medium text-[#202124] transition-colors"
                title="Hospital Profile & Settings"
              >
                <span className="w-6 h-6 rounded-md bg-[#16165c] text-white text-[11px] font-semibold flex items-center justify-center">
                  {(portalSubtitle || user?.full_name || 'H').slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate">{portalSubtitle || user?.full_name}</span>
              </button>
            )}

            {notifOpen && (
              <div
                className={`absolute right-0 top-12 w-80 sm:w-96 max-h-[26rem] flex flex-col p-0 z-50 overflow-hidden ${
                  isHosp
                    ? 'bg-white border border-[#E5E7EB] rounded-xl shadow-lg'
                    : isObs
                      ? 'bg-[#232269] border border-white/15 rounded-2xl shadow-2xl'
                      : 'glass-card-elevated'
                }`}
              >
                <div
                  className={`px-4 py-3 border-b flex items-center justify-between ${
                    isObs ? 'border-white/10' : 'border-[#E5E7EB]'
                  }`}
                >
                  <span className={`text-[13px] font-semibold ${isObs ? 'text-white' : 'text-[#202124]'}`}>
                    Notifications
                  </span>
                  <div className="flex items-center gap-3">
                    {hasNotificationsTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onTabChange('notifications');
                        }}
                        className={`text-[12px] font-medium hover:underline ${
                          isHosp ? 'text-[#5350cc]' : isObs ? 'text-[#00ffaa]' : 'text-[#0071e3]'
                        }`}
                      >
                        View all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className={`inline-flex items-center gap-1 text-[12px] font-medium hover:underline ${
                        isHosp ? 'text-[#16165c]' : isObs ? 'text-[#00b1ff]' : 'text-[#0071e3]'
                      }`}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  </div>
                </div>
                <div className={`overflow-y-auto divide-y ${isObs ? 'divide-white/10' : 'divide-[#E5E7EB]'}`}>
                  {notifications.length === 0 ? (
                    <p className={`p-6 text-center text-[13px] ${isObs ? 'text-[#b0b3d6]' : 'text-[#777D87]'}`}>
                      No notifications
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleMarkOneRead(n.id)}
                        className={`w-full text-left p-3.5 transition-colors ${
                          isObs
                            ? `hover:bg-white/[0.06] ${n.is_read ? 'opacity-65' : 'bg-[#00b1ff]/10'}`
                            : `hover:bg-[#F7F8FA] ${n.is_read ? 'opacity-65' : 'bg-[#5350cc]/[0.05]'}`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] font-semibold ${isObs ? 'text-white' : 'text-[#202124]'}`}>
                            {n.title}
                          </span>
                          <span className={`text-[11px] font-mono-tabular ${isObs ? 'text-[#b0b3d6]' : 'text-[#777D87]'}`}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-[12px] mt-0.5 leading-snug ${isObs ? 'text-[#b0b3d6]' : 'text-[#777D87]'}`}>
                          {n.message}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className={`flex-1 p-4 sm:p-6 lg:p-7 w-full mx-auto ${isHosp ? 'max-w-[1360px]' : 'max-w-[1200px]'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
