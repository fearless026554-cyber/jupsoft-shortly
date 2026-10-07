'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api, clearApiCache, LinkItem, TenantItem, getAuthToken, setAuthToken, getStoredUser, setStoredUser } from '../api';

// Layout Components
import { Rail, ActiveModule } from './layout/Rail';
import { Header } from './layout/Header';
import { CanvasDrawer } from './layout/CanvasDrawer';

// View Modules
import { DashboardView } from './views/DashboardView';
import { LinksView } from './views/LinksView';
import { BulkStudioView } from './views/BulkStudioView';
import { OutcomesView } from './views/OutcomesView';
import { QrStudioView } from './views/QrStudioView';
import { AnalyticsView } from './views/AnalyticsView';
import { TenantsView } from './views/TenantsView';
import { UsersView } from './views/UsersView';
import { DomainsView } from './views/DomainsView';
import { AbuseView } from './views/AbuseView';
import { ApiKeysView } from './views/ApiKeysView';
import { HelpGuideView } from './views/HelpGuideView';
import { ProfileView } from './views/ProfileView';

// Modals
import { CreateLinkModal } from './modals/CreateLinkModal';
import { CreateTenantModal } from './modals/CreateTenantModal';
import { InviteUserModal } from './modals/InviteUserModal';
import { CreateApiKeyModal } from './modals/CreateApiKeyModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Permissions } from '../utils/rbac';

// Route mapping for full semantic routing
const MODULE_ROUTES: Record<ActiveModule, string> = {
  overview: '/dashboard',
  links: '/links',
  bulk: '/bulk',
  outcomes: '/outcomes',
  qr: '/qr',
  analytics: '/reports',
  tenants: '/tenants',
  users: '/users',
  domains: '/domains',
  abuse: '/abuse',
  apikeys: '/apikeys',
  profile: '/profile',
  help: '/help',
};

const ROUTE_TO_MODULE: Record<string, ActiveModule> = {
  '/dashboard': 'overview',
  '/overview': 'overview',
  '/links': 'links',
  '/bulk': 'bulk',
  '/outcomes': 'outcomes',
  '/qr': 'qr',
  '/reports': 'analytics',
  '/analytics': 'analytics',
  '/tenants': 'tenants',
  '/users': 'users',
  '/domains': 'domains',
  '/abuse': 'abuse',
  '/apikeys': 'apikeys',
  '/profile': 'profile',
  '/help': 'help',
};

interface ConsoleAppProps {
  initialTab?: string;
}

export function ConsoleApp({ initialTab }: ConsoleAppProps) {
  // Resolve initial module from prop or fallback to current pathname
  const resolveModule = (): ActiveModule => {
    if (initialTab) {
      const normalized = initialTab.startsWith('/') ? initialTab : '/' + initialTab;
      if (ROUTE_TO_MODULE[normalized]) return ROUTE_TO_MODULE[normalized];
      if (initialTab in MODULE_ROUTES) return initialTab as ActiveModule;
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/\/$/, '') || '/dashboard';
      if (ROUTE_TO_MODULE[path]) return ROUTE_TO_MODULE[path];
    }
    return 'overview';
  };

  // Authentication & Session State (Instant optimistic read from localStorage)
  const [currentUser, setCurrentUser] = useState<any>(() => getStoredUser());
  const [activeTab, setActiveTab] = useState<ActiveModule>(resolveModule);

  // Multi-Tenant Hierarchy State (Persisted across reload R2)
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jlmp_active_tenant_id') || 'all';
    }
    return 'all';
  });

  const setActiveTenantId = (id: string) => {
    setActiveTenantIdState(id);
    setSelectedQrLink(null); // Reset selected QR link when switching tenant (R5)
    if (typeof window !== 'undefined') {
      localStorage.setItem('jlmp_active_tenant_id', id);
    }
  };

  // Core Data State
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ status: string; services?: { database: string; redis: string } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [abuseCount, setAbuseCount] = useState<number>(0);

  const isTabAllowed = (tab: ActiveModule, role?: string): boolean => {
    switch (tab) {
      case 'tenants':
        return Permissions.canManageTenants(role);
      case 'users':
        return Permissions.canViewUsers(role);
      case 'domains':
        return Permissions.canManageDomains(role);
      case 'abuse':
        return Permissions.canManageAbuse(role);
      case 'apikeys':
        return Permissions.canManageApiKeys(role);
      default:
        return true;
    }
  };

  // Synchronize route with URL pathname & popstate events
  const handleNavigate = (tab: ActiveModule) => {
    const targetTab = isTabAllowed(tab, currentUser?.role) ? tab : 'overview';
    setActiveTab(targetTab);
    setDrawerLink(null);
    if (typeof window !== 'undefined') {
      const targetPath = MODULE_ROUTES[targetTab] || '/dashboard';
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const syncRouteFromPath = () => {
      if (typeof window === 'undefined') return;
      setDrawerLink(null);
      const path = window.location.pathname.replace(/\/$/, '') || '/dashboard';

      if (path === '/' || path === '/landing') {
        window.location.href = '/';
        return;
      }

      const matched = ROUTE_TO_MODULE[path];
      if (matched) {
        if (isTabAllowed(matched, currentUser?.role)) {
          setActiveTab(matched);
        } else {
          setActiveTab('overview');
        }
      }
    };

    window.addEventListener('popstate', syncRouteFromPath);
    return () => window.removeEventListener('popstate', syncRouteFromPath);
  }, [currentUser]);

  // Close slide-over drawer when activeTab changes
  useEffect(() => {
    setDrawerLink(null);
  }, [activeTab]);

  // Clamp current tab if role restrictions change
  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab, currentUser?.role)) {
      handleNavigate('overview');
    }
  }, [currentUser, activeTab]);

  // Check auth and silent background session revalidation
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }

    const stored = getStoredUser();
    if (stored && !currentUser) {
      setCurrentUser(stored);
    }

    api.getMe().then((res) => {
      if (res && res.success && res.data?.user) {
        setCurrentUser(res.data.user);
        setStoredUser(res.data.user);
      } else {
        setAuthToken(null);
        setStoredUser(null);
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }).catch(() => {
      const existing = getStoredUser();
      if (!existing && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    });
  }, []);

  // Slide-over Canvas Drawer State
  const [drawerLink, setDrawerLink] = useState<LinkItem | null>(null);

  // QR Studio Active Link State
  const [selectedQrLink, setSelectedQrLink] = useState<LinkItem | null>(null);

  // Modals Open State
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateTenantModalOpen, setIsCreateTenantModalOpen] = useState(false);
  const [isInviteUserModalOpen, setIsInviteUserModalOpen] = useState(false);
  const [isCreateApiKeyModalOpen, setIsCreateApiKeyModalOpen] = useState(false);
  
  // Global Confirm Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Load Tenants & Data
  const loadTenants = async () => {
    try {
      const data = await api.getTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch {
      setTenants([]);
    }
  };

  const loadSeqRef = useRef(0);

  const loadData = async (forceRefresh = false) => {
    if (!currentUser) return;
    const currentSeq = ++loadSeqRef.current;
    setLoading(true);
    try {
      if (forceRefresh) {
        clearApiCache();
      }

      // 1. Fetch links for the active tenant/workspace
      const linkPromise = api.getLinks(activeTenantId !== 'all' ? activeTenantId : undefined).catch(() => []);

      // 2. Fetch tenants only if not yet populated OR user forces refresh AND has permission
      const shouldFetchTenants = (tenants.length === 0 || forceRefresh) && Permissions.canManageTenants(currentUser?.role);
      const tenantPromise = shouldFetchTenants ? api.getTenants().catch(() => []) : Promise.resolve(tenants);

      // 3. Fetch lightweight abuse count only if user has permission to manage abuse
      const shouldFetchAbuse = Permissions.canManageAbuse(currentUser?.role);
      const abusePromise = shouldFetchAbuse ? api.getAbuseCount().catch(() => 0) : Promise.resolve(0);

      // 4. Background health status
      const healthPromise = api.getHealth().catch(() => null);

      const [h, l, t, a] = await Promise.all([
        healthPromise,
        linkPromise,
        tenantPromise,
        abusePromise,
      ]);

      // Sequence check to prevent stale out-of-order responses overwriting newer data (B5)
      if (currentSeq !== loadSeqRef.current) return;

      if (h) setHealth(h);
      const safeLinks = Array.isArray(l) ? l : [];
      setLinks(safeLinks);
      if (Array.isArray(t) && t.length > 0) setTenants(t);
      if (shouldFetchAbuse) {
        setAbuseCount(typeof a === 'number' ? a : 0);
      }

      // Reconcile selectedQrLink (R5)
      if (safeLinks.length > 0) {
        setSelectedQrLink((prev) => {
          if (!prev || !safeLinks.some((x) => x.id === prev.id)) {
            return safeLinks[0];
          }
          return prev;
        });
      } else {
        setSelectedQrLink(null);
      }
    } catch (err) {
      console.error('Failed to load JLMP data:', err);
    } finally {
      if (currentSeq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const refreshLinks = async () => {
    try {
      const l = await api.getLinks(activeTenantId !== 'all' ? activeTenantId : undefined);
      const safeLinks = Array.isArray(l) ? l : [];
      setLinks(safeLinks);
      if (safeLinks.length > 0 && !selectedQrLink) {
        setSelectedQrLink(safeLinks[0]);
      }
    } catch (err) {
      console.error('Failed to refresh links:', err);
    }
  };

  const handleManualRefresh = async () => {
    await loadData(true);
  };

  useEffect(() => {
    if (!currentUser) return;

    loadData();

    // Background health check polling: 30s, only when browser tab is active/visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        api.getHealth().then(setHealth).catch(() => null);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser?.id, activeTenantId]);

  // Keyboard shortcut listener (Ctrl + / for Search, Alt + C for Create Link)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('zoho-global-search');
        if (searchInput) searchInput.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'c' && !isInput) {
        e.preventDefault();
        setIsCreateLinkModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleArchiveLink = async (id: string) => {
    const targetLink = links.find((l) => l.id === id);
    const domainHost =
      (targetLink as any)?.domain?.hostname ||
      process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN ||
      '';
    const fullUrl = targetLink ? `https://${domainHost}/${targetLink.short_code}` : 'this short link';
    setConfirmConfig({
      isOpen: true,
      title: 'Archive Link',
      message: `Are you sure you want to archive the link ${fullUrl}? It will be deactivated and moved to Archive.`,
      onConfirm: async () => {
        await api.archiveLink(id);
        if (drawerLink?.id === id) setDrawerLink(null);
        await refreshLinks();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRestoreLink = async (id: string) => {
    try {
      await api.updateLink(id, { status: 'active' });
      if (drawerLink?.id === id) {
        setDrawerLink((prev) => prev ? { ...prev, status: 'active' } : null);
      }
      await refreshLinks();
    } catch (err) {
      console.error('Failed to restore link:', err);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    try {
      await api.deleteLinkPermanently(id);
      if (drawerLink?.id === id) setDrawerLink(null);
      await refreshLinks();
    } catch (err) {
      console.error('Failed to permanently delete link:', err);
    }
  };

  const handleBatchArchive = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.archiveLink(id)));
      if (drawerLink && ids.includes(drawerLink.id)) setDrawerLink(null);
      await refreshLinks();
    } catch (err) {
      console.error('Batch archive failed:', err);
      await refreshLinks();
    }
  };

  const handleBatchRestore = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.updateLink(id, { status: 'active' })));
      if (drawerLink && ids.includes(drawerLink.id)) {
        setDrawerLink((prev) => (prev ? { ...prev, status: 'active' } : null));
      }
      await refreshLinks();
    } catch (err) {
      console.error('Batch restore failed:', err);
      await refreshLinks();
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.deleteLinkPermanently(id)));
      if (drawerLink && ids.includes(drawerLink.id)) setDrawerLink(null);
      await refreshLinks();
    } catch (err) {
      console.error('Batch permanent delete failed:', err);
      await refreshLinks();
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F6F9] font-sans antialiased text-slate-800">
      {/* 1. Exact 64px Icon-First Rail */}
      <Rail
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        linksCount={links.length}
        abuseCount={abuseCount}
        currentUser={currentUser}
      />

      {/* 2. Main Application Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Dark Navy Header */}
        <Header
          tenants={tenants}
          activeTenantId={activeTenantId}
          setActiveTenantId={setActiveTenantId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          health={health}
          loading={loading}
          onRefresh={handleManualRefresh}
          onCreateLinkClick={() => setIsCreateLinkModalOpen(true)}
          onOpenCreateTenantModal={() => setIsCreateTenantModalOpen(true)}
          currentUser={currentUser}
          onLogout={() => {
            api.logout().then(() => {
              window.location.href = '/login';
            });
          }}
          onNavigate={handleNavigate}
        />

        {/* Dynamic Content Workspace Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5 relative bg-[#F4F6F9]">
          {/* Contextual Sub-Tab Bar for Grouped Modules */}
          {(activeTab === 'links' || activeTab === 'bulk' || activeTab === 'qr') && (
            <div className="mb-3.5 flex items-center gap-1 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => handleNavigate('links')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'links'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                All Links
              </button>
              {Permissions.canBulkCreate(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('bulk')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                    activeTab === 'bulk'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Bulk CSV Studio
                </button>
              )}
              <button
                type="button"
                onClick={() => handleNavigate('qr')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'qr'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                QR Studio
              </button>
            </div>
          )}

          {/* Contextual Sub-Tab Bar for Settings Modules */}
          {(activeTab === 'tenants' || activeTab === 'users' || activeTab === 'domains' || activeTab === 'abuse' || activeTab === 'apikeys') && (
            <div className="mb-3.5 flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
              {Permissions.canManageTenants(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('tenants')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'tenants'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Tenants & Workspaces
                </button>
              )}
              {Permissions.canViewUsers(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('users')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Users & Roles
                </button>
              )}
              {Permissions.canManageDomains(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('domains')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'domains'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Custom Domains
                </button>
              )}
              {Permissions.canManageAbuse(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('abuse')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'abuse'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <span>Abuse & Security</span>
                  {abuseCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-mono">
                      {abuseCount}
                    </span>
                  )}
                </button>
              )}
              {Permissions.canManageApiKeys(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('apikeys')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'apikeys'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  API Keys
                </button>
              )}
            </div>
          )}

          {/* Module 1: Dashboard Home */}
          {activeTab === 'overview' && (
            <DashboardView
              links={links}
              loading={loading}
              onNavigateToLinks={() => handleNavigate('links')}
              onNavigateToOutcomes={() => handleNavigate('outcomes')}
              onSelectDrawerLink={(link) => setDrawerLink(link)}
              onOpenCreateModal={() => setIsCreateLinkModalOpen(true)}
              currentUser={currentUser}
            />
          )}

          {/* Module 2: Links Data Grid */}
          {activeTab === 'links' && (
            <LinksView
              links={links}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onOpenCreateModal={() => setIsCreateLinkModalOpen(true)}
              onSelectDrawerLink={(link) => setDrawerLink(link)}
              onSelectQrLink={(link) => {
                setSelectedQrLink(link);
                handleNavigate('qr');
              }}
              onArchiveLink={handleArchiveLink}
              onRestoreLink={handleRestoreLink}
              onDeletePermanently={handleDeletePermanently}
              onBatchArchive={handleBatchArchive}
              onBatchRestore={handleBatchRestore}
              onBatchDelete={handleBatchDelete}
              activeDrawerLinkId={drawerLink?.id}
              currentUser={currentUser}
            />
          )}

          {/* Module 3: Bulk CSV Studio */}
          {activeTab === 'bulk' && <BulkStudioView currentUser={currentUser} />}

          {/* Module 4: Outcomes & Fee Ledger */}
          {activeTab === 'outcomes' && <OutcomesView links={links} currentUser={currentUser} />}

          {/* Module 5: QR Code Studio */}
          {activeTab === 'qr' && (
            <QrStudioView
              links={links}
              selectedLink={selectedQrLink}
              onSelectLink={setSelectedQrLink}
            />
          )}

          {/* Module 6: Traffic Analytics & DPDP */}
          {activeTab === 'analytics' && <AnalyticsView links={links} />}

          {/* Module 7: Super Admin Tenants Directory */}
          {activeTab === 'tenants' && (
            <TenantsView
              tenants={tenants}
              activeTenantId={activeTenantId}
              onSelectTenant={(id) => {
                setActiveTenantId(id);
                handleNavigate('links');
              }}
              onOpenCreateTenantModal={() => setIsCreateTenantModalOpen(true)}
              onRefreshTenants={() => {
                clearApiCache('tenants');
                loadTenants();
              }}
            />
          )}

          {/* Module 8: Users & RBAC */}
          {activeTab === 'users' && (
            <UsersView
              onOpenInviteModal={() => setIsInviteUserModalOpen(true)}
              currentUser={currentUser}
            />
          )}

          {/* Module 9: Domains & TRAI DLT */}
          {activeTab === 'domains' && <DomainsView currentUser={currentUser} />}

          {/* Module 10: Abuse Quarantine & Killswitch */}
          {activeTab === 'abuse' && (
            <AbuseView
              onRefreshBadge={() => setAbuseCount((prev) => Math.max(0, prev - 1))}
              currentUser={currentUser}
            />
          )}

          {/* Module 11: Developer API Keys */}
          {activeTab === 'apikeys' && (
            <ApiKeysView
              onOpenCreateKeyModal={() => setIsCreateApiKeyModalOpen(true)}
              currentUser={currentUser}
            />
          )}

          {/* Module 12: Help & TRAI Knowledge Base */}
          {activeTab === 'help' && <HelpGuideView />}

          {/* Module 13: Operator Account & Security Profile */}
          {activeTab === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              tenants={tenants}
              onUserUpdated={() => {
                const updated = getStoredUser();
                if (updated) setCurrentUser(updated);
                api.getMe().then((res) => {
                  if (res?.data?.user) setCurrentUser(res.data.user);
                });
              }}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

      {/* 3. Zoho Right Slide-Over Canvas Drawer */}
      <CanvasDrawer
        link={drawerLink}
        onClose={() => setDrawerLink(null)}
        onArchive={handleArchiveLink}
        onRestore={handleRestoreLink}
        onDeletePermanently={handleDeletePermanently}
        onLinkUpdated={(updated) => {
          setDrawerLink(updated);
          refreshLinks();
        }}
      />

      {/* 4. Global Modals */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={refreshLinks}
      />

      <CreateTenantModal
        isOpen={isCreateTenantModalOpen}
        onClose={() => setIsCreateTenantModalOpen(false)}
        onTenantCreated={() => {
          loadTenants();
          loadData();
        }}
      />

      <InviteUserModal
        isOpen={isInviteUserModalOpen}
        onClose={() => setIsInviteUserModalOpen(false)}
        onUserInvited={() => {
          loadData();
        }}
        currentUser={currentUser}
      />

      <CreateApiKeyModal
        isOpen={isCreateApiKeyModalOpen}
        onClose={() => setIsCreateApiKeyModalOpen(false)}
        onKeyCreated={() => {}}
      />

      {/* 5. Zoho Destructive Action Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Archive"
        isDestructive={true}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
