'use client';

import React, { useState, useEffect } from 'react';
import { api, LinkItem, TenantItem, getAuthToken, setAuthToken, getStoredUser, setStoredUser } from '../api';

// Layout Components
import { Rail, ActiveModule } from '../components/layout/Rail';
import { Header } from '../components/layout/Header';
import { CanvasDrawer } from '../components/layout/CanvasDrawer';

// View Modules
import { DashboardView } from '../components/views/DashboardView';
import { LinksView } from '../components/views/LinksView';
import { BulkStudioView } from '../components/views/BulkStudioView';
import { OutcomesView } from '../components/views/OutcomesView';
import { QrStudioView } from '../components/views/QrStudioView';
import { AnalyticsView } from '../components/views/AnalyticsView';
import { TenantsView } from '../components/views/TenantsView';
import { UsersView } from '../components/views/UsersView';
import { DomainsView } from '../components/views/DomainsView';
import { AbuseView } from '../components/views/AbuseView';
import { ApiKeysView } from '../components/views/ApiKeysView';
import { HelpGuideView } from '../components/views/HelpGuideView';

// Modals
import { CreateLinkModal } from '../components/modals/CreateLinkModal';
import { CreateTenantModal } from '../components/modals/CreateTenantModal';
import { InviteUserModal } from '../components/modals/InviteUserModal';
import { CreateApiKeyModal } from '../components/modals/CreateApiKeyModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Permissions } from '../utils/rbac';

// Route mapping for full semantic routing
const MODULE_ROUTES: Record<ActiveModule, string> = {
  overview: '/',
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
  help: '/help',
};

const ROUTE_TO_MODULE: Record<string, ActiveModule> = {
  '/': 'overview',
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
  '/help': 'help',
};

export default function ShortlyCRMApp() {
  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<any>(() => getStoredUser());
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Navigation Module State
  const [activeTab, setActiveTab] = useState<ActiveModule>('overview');

  // Multi-Tenant Hierarchy State
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('all'); // 'all' or Tenant UUID

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
    if (typeof window !== 'undefined') {
      const targetPath = MODULE_ROUTES[targetTab] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const syncRouteFromPath = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      const matched = ROUTE_TO_MODULE[path];
      if (matched) {
        if (isTabAllowed(matched, currentUser?.role)) {
          setActiveTab(matched);
        } else {
          setActiveTab('overview');
          window.history.replaceState(null, '', '/');
        }
      }
    };

    syncRouteFromPath();
    window.addEventListener('popstate', syncRouteFromPath);
    return () => window.removeEventListener('popstate', syncRouteFromPath);
  }, [currentUser]);

  // Clamp current tab if role restrictions change
  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab, currentUser?.role)) {
      handleNavigate('overview');
    }
  }, [currentUser, activeTab]);

  // Verify authentication on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    api.getMe().then((res) => {
      if (res && res.success && res.data?.user) {
        setCurrentUser(res.data.user);
        setIsAuthChecking(false);
      } else {
        setAuthToken(null);
        setStoredUser(null);
        window.location.href = '/login';
      }
    }).catch(() => {
      const stored = getStoredUser();
      if (stored) {
        setCurrentUser(stored);
        setIsAuthChecking(false);
      } else {
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, l, t, a] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getLinks(activeTenantId !== 'all' ? activeTenantId : undefined).catch(() => []),
        api.getTenants().catch(() => []),
        api.getAbuseReports().catch(() => []),
      ]);

      if (h) setHealth(h);
      const safeLinks = Array.isArray(l) ? l : [];
      setLinks(safeLinks);
      if (Array.isArray(t)) setTenants(t);
      if (Array.isArray(a)) {
        setAbuseCount(a.filter((rep: any) => rep.status === 'pending').length);
      }

      if (safeLinks.length > 0 && !selectedQrLink) {
        setSelectedQrLink(safeLinks[0]);
      }
    } catch (err) {
      console.error('Failed to load JLMP data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.getHealth().then(setHealth).catch(() => null);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTenantId]);

  // Keyboard shortcut listener (Ctrl + / for Search, C for Create Link)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('zoho-global-search');
        if (searchInput) searchInput.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
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
      message: `Are you sure you want to archive the link ${fullUrl}? It will be deactivated and removed from active SMS routing.`,
      onConfirm: async () => {
        await api.archiveLink(id);
        if (drawerLink?.id === id) setDrawerLink(null);
        loadData();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#071320] flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono text-slate-400">Verifying session credentials...</p>
      </div>
    );
  }

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
          onRefresh={loadData}
          onCreateLinkClick={() => setIsCreateLinkModalOpen(true)}
          onOpenCreateTenantModal={() => setIsCreateTenantModalOpen(true)}
          currentUser={currentUser}
          onLogout={() => {
            api.logout().then(() => {
              window.location.href = '/login';
            });
          }}
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
                  Bulk CSV
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
                QR Codes
              </button>
            </div>
          )}

          {(activeTab === 'analytics' || activeTab === 'outcomes') && (
            <div className="mb-3.5 flex items-center gap-1 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => handleNavigate('analytics')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                Traffic Reports
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('outcomes')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'outcomes'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                Outcomes & Revenue
              </button>
            </div>
          )}

          {(activeTab === 'tenants' ||
            activeTab === 'users' ||
            activeTab === 'domains' ||
            activeTab === 'abuse' ||
            activeTab === 'apikeys') && (
            <div className="mb-3.5 flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2">
              {Permissions.canManageTenants(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('tenants')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                    activeTab === 'tenants'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Tenants
                </button>
              )}
              {Permissions.canViewUsers(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('users')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
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
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
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
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
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
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
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
              onRefreshTenants={loadTenants}
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
        </main>
      </div>

      {/* 3. Zoho Right Slide-Over Canvas Drawer */}
      <CanvasDrawer
        link={drawerLink}
        onClose={() => setDrawerLink(null)}
        onArchive={handleArchiveLink}
      />

      {/* 4. Global Modals */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={loadData}
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
        onUserInvited={() => {}}
      />

      <CreateApiKeyModal
        isOpen={isCreateApiKeyModalOpen}
        onClose={() => setIsCreateApiKeyModalOpen(false)}
        onKeyCreated={() => {}}
      />
      
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
