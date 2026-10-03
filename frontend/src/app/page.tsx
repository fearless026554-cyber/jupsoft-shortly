'use client';

import React, { useState, useEffect } from 'react';
import { api, LinkItem, TenantItem } from '../api';

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

  // Synchronize route with URL pathname & popstate events
  const handleNavigate = (tab: ActiveModule) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const targetPath = MODULE_ROUTES[tab] || '/';
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
        setActiveTab(matched);
      }
    };

    syncRouteFromPath();
    window.addEventListener('popstate', syncRouteFromPath);
    return () => window.removeEventListener('popstate', syncRouteFromPath);
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
    setConfirmConfig({
      isOpen: true,
      title: 'Archive Link',
      message: 'Archive this short link? It will be deactivated and removed from active SMS routing.',
      onConfirm: async () => {
        await api.archiveLink(id);
        if (drawerLink?.id === id) setDrawerLink(null);
        loadData();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F6F9] font-sans antialiased text-slate-800">
      {/* 1. Exact 64px Icon-First Rail */}
      <Rail
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        linksCount={links.length}
        abuseCount={abuseCount}
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
        />

        {/* Dynamic Content Workspace Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5 relative bg-[#F4F6F9]">
          {/* Module 1: Dashboard Home */}
          {activeTab === 'overview' && (
            <DashboardView
              links={links}
              loading={loading}
              onNavigateToLinks={() => handleNavigate('links')}
              onNavigateToOutcomes={() => handleNavigate('outcomes')}
              onSelectDrawerLink={(link) => setDrawerLink(link)}
              onOpenCreateModal={() => setIsCreateLinkModalOpen(true)}
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
            />
          )}

          {/* Module 3: Bulk CSV Studio */}
          {activeTab === 'bulk' && <BulkStudioView />}

          {/* Module 4: Outcomes & Fee Ledger */}
          {activeTab === 'outcomes' && <OutcomesView links={links} />}

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
            <UsersView onOpenInviteModal={() => setIsInviteUserModalOpen(true)} />
          )}

          {/* Module 9: Domains & TRAI DLT */}
          {activeTab === 'domains' && <DomainsView />}

          {/* Module 10: Abuse Quarantine & Killswitch */}
          {activeTab === 'abuse' && (
            <AbuseView onRefreshBadge={() => setAbuseCount((prev) => Math.max(0, prev - 1))} />
          )}

          {/* Module 11: Developer API Keys */}
          {activeTab === 'apikeys' && (
            <ApiKeysView onOpenCreateKeyModal={() => setIsCreateApiKeyModalOpen(true)} />
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
