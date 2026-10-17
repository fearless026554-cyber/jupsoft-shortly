'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { ApiDocsView } from './views/ApiDocsView';
import { HelpGuideView } from './views/HelpGuideView';
import { ProfileView } from './views/ProfileView';

// Modals
import { CreateLinkModal } from './modals/CreateLinkModal';
import { CreateTenantModal } from './modals/CreateTenantModal';
import { InviteUserModal } from './modals/InviteUserModal';
import { CreateApiKeyModal } from './modals/CreateApiKeyModal';
import { PermanentLinkDeleteModal } from './modals/PermanentLinkDeleteModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Permissions, isPermanentLink } from '../utils/rbac';

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
  docs: '/docs',
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
  '/docs': 'docs',
  '/apidocs': 'docs',
  '/api-docs': 'docs',
  '/developers': 'docs',
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

  // Authentication & Session State (Instant optimistic read from localStorage with JWT fallback)
  const [currentUser, setCurrentUser] = useState<any>(() => getStoredUser());
  const [activeTab, setActiveTab] = useState<ActiveModule>(resolveModule);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = getStoredUser();
    if (stored && !currentUser) {
      setCurrentUser(stored);
    }
  }, []);

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

  const activeTenantName = useMemo(() => {
    if (activeTenantId === 'all') return 'All Tenants';
    return tenants.find((t) => t.id === activeTenantId)?.name;
  }, [tenants, activeTenantId]);

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
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code') || urlParams.get('token') || urlParams.get('credential')) {
          return;
        }
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
      } else if (res && (res._status === 401 || res.status === 401 || res.error?.code === 'UNAUTHORIZED')) {
        // Explicit session expiration or invalidation from backend
        setAuthToken(null);
        setStoredUser(null);
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login?expired=1';
        }
      }
      // For any transient failures (res is null, rate limit 429, proxy 502, network offline):
      // DO NOT LOG OUT! The user's valid session in localStorage and cookies remains active.
    }).catch(() => {
      // Network drop: do not log out
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

  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<LinkItem | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);

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
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const currentSeq = ++loadSeqRef.current;
    setLoading(true);

    // Timeout safety fallback: Force disable loading after 6s to ensure UI never permanently hangs on skeleton
    const timeoutTimer = setTimeout(() => {
      if (currentSeq >= loadSeqRef.current) {
        setLoading(false);
      }
    }, 6000);

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

      // Only skip state update if a strictly newer sequence has started
      if (currentSeq < loadSeqRef.current) return;

      if (h) setHealth(h);
      const safeLinks = Array.isArray(l) ? l : [];
      setLinks(safeLinks);
      if (Array.isArray(t) && t.length > 0) setTenants(t);
      if (shouldFetchAbuse) {
        setAbuseCount(typeof a === 'number' ? a : 0);
      }

      // Reconcile selectedQrLink (R5) - filter out archived links
      const activeQrCandidates = safeLinks.filter((l) => l.status !== 'archived');
      if (activeQrCandidates.length > 0) {
        setSelectedQrLink((prev) => {
          if (!prev || prev.status === 'archived' || !activeQrCandidates.some((x) => x.id === prev.id)) {
            return activeQrCandidates[0];
          }
          return prev;
        });
      } else {
        setSelectedQrLink(null);
      }
    } catch (err) {
      console.error('Failed to load JLMP data:', err);
    } finally {
      clearTimeout(timeoutTimer);
      if (currentSeq >= loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const refreshLinks = async () => {
    try {
      const l = await api.getLinks(activeTenantId !== 'all' ? activeTenantId : undefined);
      const safeLinks = Array.isArray(l) ? l : [];
      setLinks(safeLinks);
      const activeQrCandidates = safeLinks.filter((l) => l.status !== 'archived');
      if (activeQrCandidates.length > 0 && (!selectedQrLink || selectedQrLink.status === 'archived')) {
        setSelectedQrLink(activeQrCandidates[0]);
      }
    } catch (err) {
      console.error('Failed to refresh links:', err);
    }
  };

  const handleLinkCreated = (newLinkData?: any) => {
    if (newLinkData && newLinkData.id) {
      const formattedLink: LinkItem = {
        id: newLinkData.id,
        tenant_id: newLinkData.tenantId || (activeTenantId !== 'all' ? activeTenantId : (tenants[0]?.id || '')),
        short_code: newLinkData.shortCode || newLinkData.short_code,
        destination_url: newLinkData.destinationUrl || newLinkData.destination_url,
        alias: newLinkData.alias || null,
        tag: newLinkData.tag || 'General',
        redirect_type: newLinkData.redirectType || newLinkData.redirect_type || '307',
        status: newLinkData.status || 'active',
        click_count: 0,
        created_at: newLinkData.createdAt || newLinkData.created_at || new Date().toISOString(),
        expires_at: newLinkData.expiresAt || newLinkData.expires_at || null,
        max_clicks: newLinkData.maxClicks || newLinkData.max_clicks || null,
        external_ref: newLinkData.externalRef || newLinkData.external_ref || null,
        is_permanent: Boolean(newLinkData.isPermanent || newLinkData.is_permanent),
      };
      // Optimistic prepend: instant UI feedback (0ms)
      setLinks((prev) => [formattedLink, ...prev.filter((l) => l.id !== formattedLink.id)]);
      setSelectedQrLink(formattedLink);
    }
    // Background refresh silently without blocking UI
    refreshLinks().catch(() => {});
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
    if (!targetLink) return;

    if (isPermanentLink(targetLink)) {
      if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
        setAlertConfig({
          isOpen: true,
          title: 'Permission Denied',
          message: 'This link is a Permanent Protected Asset. Only Super Admin and Tenant Admin can archive or delete permanent links.',
        });
        return;
      }
      setPermanentDeleteTarget(targetLink);
      return;
    }

    const domainHost =
      (targetLink as any)?.domain?.hostname ||
      process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN ||
      '';
    const fullUrl = `https://${domainHost}/${targetLink.short_code}`;
    setConfirmConfig({
      isOpen: true,
      title: 'Archive Link',
      message: `Are you sure you want to archive the link ${fullUrl}? It will be deactivated and moved to Archive. Note: standard links cannot be restored once archived.`,
      onConfirm: async () => {
        await api.archiveLink(id);
        if (drawerLink?.id === id) setDrawerLink(null);
        await refreshLinks();
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleRestoreLink = async (id: string) => {
    const targetLink = links.find((l) => l.id === id);
    if (targetLink && !isPermanentLink(targetLink)) {
      setAlertConfig({
        isOpen: true,
        title: 'Cannot Restore',
        message: 'Only Permanent Protected links can be restored. Standard links cannot be restored once archived.',
      });
      return;
    }

    if (targetLink && isPermanentLink(targetLink) && !Permissions.canManagePermanentLinks(currentUser?.role)) {
      setAlertConfig({
        isOpen: true,
        title: 'Permission Denied',
        message: 'Only Super Admin and Tenant Admin can restore Permanent Protected links.',
      });
      return;
    }

    try {
      const res = await api.updateLink(id, { status: 'active' });
      if (res.success) {
        if (drawerLink?.id === id) {
          setDrawerLink((prev) => (prev ? { ...prev, status: 'active' } : null));
        }
        await refreshLinks();
      } else {
        setAlertConfig({
          isOpen: true,
          title: 'Restore Failed',
          message: res.error?.message || 'Failed to restore link.',
        });
      }
    } catch (err: any) {
      console.error('Failed to restore link:', err);
      setAlertConfig({
        isOpen: true,
        title: 'Restore Failed',
        message: err?.message || 'Network error while restoring link.',
      });
    }
  };

  const handleDeletePermanently = async (id: string) => {
    const targetLink = links.find((l) => l.id === id);
    if (!targetLink) return;

    if (isPermanentLink(targetLink)) {
      if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
        setAlertConfig({
          isOpen: true,
          title: 'Permission Denied',
          message: 'Only Super Admin and Tenant Admin can permanently delete Permanent Protected links.',
        });
        return;
      }
      setPermanentDeleteTarget(targetLink);
      return;
    }

    const domainHost =
      (targetLink as any)?.domain?.hostname ||
      process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN ||
      '';
    setConfirmConfig({
      isOpen: true,
      title: 'Permanently Delete Link',
      message: `Are you sure you want to permanently delete https://${domainHost}/${targetLink.short_code}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.deleteLinkPermanently(id);
          if (drawerLink?.id === id) setDrawerLink(null);
          await refreshLinks();
        } catch (err) {
          console.error('Failed to permanently delete link:', err);
        } finally {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleBatchArchive = async (ids: string[]) => {
    const hasPermanent = ids.some((id) => {
      const l = links.find((x) => x.id === id);
      return l && isPermanentLink(l);
    });

    if (hasPermanent && !Permissions.canManagePermanentLinks(currentUser?.role)) {
      setAlertConfig({
        isOpen: true,
        title: 'Permission Denied',
        message: 'Selected items contain Permanent Protected links. Only Super Admin and Tenant Admin can archive permanent links.',
      });
      return;
    }

    try {
      await api.batchArchive(ids);
      if (drawerLink && ids.includes(drawerLink.id)) setDrawerLink(null);
      await refreshLinks();
    } catch (err) {
      console.error('Batch archive failed:', err);
      await refreshLinks();
    }
  };

  const handleBatchRestore = async (ids: string[]) => {
    if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
      setAlertConfig({
        isOpen: true,
        title: 'Permission Denied',
        message: 'Only Super Admin and Tenant Admin can restore permanent links.',
      });
      return;
    }

    const permanentIds = ids.filter((id) => {
      const l = links.find((x) => x.id === id);
      return l && isPermanentLink(l);
    });

    if (permanentIds.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'Cannot Restore Selected',
        message: 'None of the selected links are Permanent. Standard links cannot be restored once archived.',
      });
      return;
    }

    try {
      await api.batchRestore(permanentIds);
      if (drawerLink && permanentIds.includes(drawerLink.id)) {
        setDrawerLink((prev) => (prev ? { ...prev, status: 'active' } : null));
      }
      await refreshLinks();
      if (permanentIds.length < ids.length) {
        setAlertConfig({
          isOpen: true,
          title: 'Partial Restore Completed',
          message: `Restored ${permanentIds.length} permanent link(s). The other ${ids.length - permanentIds.length} non-permanent link(s) cannot be restored.`,
        });
      }
    } catch (err) {
      console.error('Batch restore failed:', err);
      await refreshLinks();
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await api.batchDeletePermanently(ids);
      if (drawerLink && ids.includes(drawerLink.id)) setDrawerLink(null);
      await refreshLinks();
    } catch (err) {
      console.error('Batch permanent delete failed:', err);
      await refreshLinks();
    }
  };

  if (!isMounted) {
    return (
      <div className="flex h-screen w-screen bg-[#0d1527] items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl p-2 shadow-lg flex items-center justify-center border border-slate-700/60 animate-pulse">
            <img src="/jupsoft-logo.png" alt="Jupsoft Shortly" className="w-full h-full object-contain" />
          </div>
          <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Loading Shortly...</span>
        </div>
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

          {/* Contextual Sub-Tab Bar for Reports Modules */}
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

          {/* Contextual Sub-Tab Bar for Settings Modules */}
          {(activeTab === 'tenants' || activeTab === 'users' || activeTab === 'domains' || activeTab === 'abuse' || activeTab === 'apikeys' || activeTab === 'docs') && (
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
              <button
                type="button"
                onClick={() => handleNavigate('docs')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'docs'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                API Reference
              </button>
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
              activeTenantId={activeTenantId}
              activeTenantName={activeTenantName}
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
          {activeTab === 'bulk' && <BulkStudioView currentUser={currentUser} activeTenantId={activeTenantId} />}

          {/* Module 4: Outcomes & Fee Ledger */}
          {activeTab === 'outcomes' && (
            <OutcomesView
              links={links}
              currentUser={currentUser}
              activeTenantId={activeTenantId}
              activeTenantName={activeTenantName}
            />
          )}

          {/* Module 5: QR Code Studio */}
          {activeTab === 'qr' && (
            <QrStudioView
              links={links}
              selectedLink={selectedQrLink}
              onSelectLink={setSelectedQrLink}
            />
          )}

          {/* Module 6: Traffic Analytics & DPDP */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              links={links}
              activeTenantId={activeTenantId}
              activeTenantName={activeTenantName}
            />
          )}

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
              activeTenantId={activeTenantId}
            />
          )}

          {/* Module 9: Domains & TRAI DLT */}
          {activeTab === 'domains' && <DomainsView currentUser={currentUser} activeTenantId={activeTenantId} />}

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
              onNavigateToDocs={() => handleNavigate('docs')}
              currentUser={currentUser}
            />
          )}

          {/* Module 12: Help & TRAI Knowledge Base */}
          {activeTab === 'help' && <HelpGuideView />}

          {/* Module 13: Dedicated Developer API Documentation */}
          {activeTab === 'docs' && (
            <ApiDocsView
              onNavigateToApiKeys={() => handleNavigate('apikeys')}
              currentUser={currentUser}
            />
          )}

          {/* Module 14: Operator Account & Security Profile */}
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
        currentUser={currentUser}
      />

      {/* 4. Global Modals */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={handleLinkCreated}
        activeTenantId={activeTenantId}
      />

      <CreateTenantModal
        isOpen={isCreateTenantModalOpen}
        onClose={() => setIsCreateTenantModalOpen(false)}
        onTenantCreated={(newTenant) => {
          loadTenants();
          if (newTenant && newTenant.id) {
            setActiveTenantId(newTenant.id);
          }
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
        activeTenantId={activeTenantId}
        tenants={tenants}
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
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {alertConfig?.isOpen && (
        <ConfirmDialog
          isOpen={true}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText="Dismiss"
          isDestructive={false}
          onConfirm={() => setAlertConfig(null)}
          onCancel={() => setAlertConfig(null)}
        />
      )}

      {/* 6. Multi-Step Permanent Link Protected Deletion Modal */}
      <PermanentLinkDeleteModal
        isOpen={Boolean(permanentDeleteTarget)}
        link={permanentDeleteTarget}
        defaultDomain={
          (permanentDeleteTarget as any)?.domain?.hostname ||
          process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN ||
          'short.jupsoft.com'
        }
        onClose={() => setPermanentDeleteTarget(null)}
        onArchive={async (id) => {
          await api.archiveLink(id);
          if (drawerLink?.id === id) setDrawerLink(null);
          await refreshLinks();
          setPermanentDeleteTarget(null);
        }}
        onDeletePermanently={async (id) => {
          await api.deleteLinkPermanently(id);
          if (drawerLink?.id === id) setDrawerLink(null);
          await refreshLinks();
          setPermanentDeleteTarget(null);
        }}
      />
    </div>
  );
}
