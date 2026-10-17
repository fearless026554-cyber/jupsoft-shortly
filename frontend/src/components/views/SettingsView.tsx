'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Globe,
  ShieldAlert,
  Key,
  BookOpen,
  Plus,
  RefreshCw,
  Lock,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { TenantItem, api, clearApiCache } from '../../api';
import { Permissions } from '../../utils/rbac';

// Sub-views
import { TenantsView } from './TenantsView';
import { UsersView } from './UsersView';
import { DomainsView } from './DomainsView';
import { AbuseView } from './AbuseView';
import { ApiKeysView } from './ApiKeysView';
import { ApiDocsView } from './ApiDocsView';

// Modals
import { CreateTenantModal } from '../modals/CreateTenantModal';
import { InviteUserModal } from '../modals/InviteUserModal';
import { CreateApiKeyModal } from '../modals/CreateApiKeyModal';

export type SettingsTab = 'tenants' | 'users' | 'domains' | 'abuse' | 'apikeys' | 'docs';

interface SettingsViewProps {
  initialSubTab?: SettingsTab;
  tenants: TenantItem[];
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  onRefreshTenants: () => void;
  currentUser?: any;
  abuseCount?: number;
  onRefreshBadge?: () => void;
  onSubTabChange?: (tab: SettingsTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialSubTab = 'tenants',
  tenants,
  activeTenantId,
  setActiveTenantId,
  onRefreshTenants,
  currentUser,
  abuseCount = 0,
  onRefreshBadge,
  onSubTabChange,
}) => {
  const userRole = currentUser?.role;
  const isSuperAdmin = userRole === 'super_admin';

  // Available tabs filtered by user permissions
  const availableTabs = React.useMemo(() => {
    const list: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number | null }[] = [];

    if (Permissions.canManageTenants(userRole)) {
      list.push({ id: 'tenants', label: 'Tenants & Workspaces', icon: Building2, badge: tenants.length });
    }
    if (Permissions.canViewUsers(userRole)) {
      list.push({ id: 'users', label: 'Users & Roles (RBAC)', icon: Users });
    }
    if (Permissions.canManageDomains(userRole)) {
      list.push({ id: 'domains', label: 'Custom Domains & DLT', icon: Globe });
    }
    if (Permissions.canManageAbuse(userRole)) {
      list.push({ id: 'abuse', label: 'Abuse & Quarantine', icon: ShieldAlert, badge: abuseCount > 0 ? abuseCount : null });
    }
    if (Permissions.canManageApiKeys(userRole)) {
      list.push({ id: 'apikeys', label: 'API Keys', icon: Key });
    }
    list.push({ id: 'docs', label: 'API Reference', icon: BookOpen });

    return list;
  }, [userRole, tenants.length, abuseCount]);

  // Determine active sub-tab (fallback to first available tab if current is forbidden)
  const defaultTab = availableTabs[0]?.id || 'tenants';
  const [activeSubTab, setActiveSubTab] = useState<SettingsTab>(() => {
    return availableTabs.some((t) => t.id === initialSubTab) ? initialSubTab : defaultTab;
  });

  useEffect(() => {
    if (initialSubTab && availableTabs.some((t) => t.id === initialSubTab)) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, availableTabs]);

  // Stats state
  const [domainsCount, setDomainsCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);

  // Modals state (encapsulated inside SettingsView)
  const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false);
  const [isInviteUserOpen, setIsInviteUserOpen] = useState(false);
  const [isCreateApiKeyOpen, setIsCreateApiKeyOpen] = useState(false);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const doms = await api.getDomains();
      if (Array.isArray(doms)) setDomainsCount(doms.length);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [activeTenantId]);

  const handleTabClick = (tabId: SettingsTab) => {
    setActiveSubTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const activeTenantsCount = tenants.filter((t) => t.status === 'active').length;

  return (
    <div className="w-full space-y-4 font-sans text-slate-800">
      {/* 1. Master Settings Header (Blogary Style) */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                System &amp; Workspace Settings
                {isSuperAdmin ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-semibold">
                    Super Admin Console
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    Workspace Operator
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized management for multi-tenant organizations, team RBAC, custom domains, abuse moderation, and developer API keys.
              </p>
            </div>
          </div>
        </div>

        {/* Contextual Action Button based on active sub-tab */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={() => {
              onRefreshTenants();
              loadStats();
            }}
            title="Refresh settings and stats"
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          </button>

          {activeSubTab === 'tenants' && isSuperAdmin && (
            <button
              onClick={() => setIsCreateTenantOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Workspace</span>
            </button>
          )}

          {activeSubTab === 'users' && Permissions.canManageUsers(userRole) && (
            <button
              onClick={() => setIsInviteUserOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Invite Member</span>
            </button>
          )}

          {activeSubTab === 'apikeys' && Permissions.canManageApiKeys(userRole) && (
            <button
              onClick={() => setIsCreateApiKeyOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate API Key</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Non-Super Admin Read-Only Notice (Blogary Style) */}
      {!isSuperAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold">Scoped Access Mode: </span>
              <span className="text-amber-800">
                Workspace tenancy and platform-wide configurations are governed by your <strong>Super Admin</strong>. You are operating within your assigned tenant entitlements.
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 shrink-0">
            Scoped Access
          </span>
        </div>
      )}

      {/* 3. Quick Metrics KPI Bar (Blogary Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Workspaces</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {tenants.length}
          </div>
          <div className="text-[10px] text-slate-400">Total registered tenants</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Active Tenants</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 font-mono">
            {activeTenantsCount}
          </div>
          <div className="text-[10px] text-slate-400">Operational &amp; verified</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Custom Domains</span>
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {domainsCount}
          </div>
          <div className="text-[10px] text-slate-400">Live authoritative DNS</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Security &amp; Abuse</span>
            {abuseCount > 0 ? (
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className={`text-xl font-bold font-mono ${abuseCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {abuseCount > 0 ? `${abuseCount} Pending` : 'Clean'}
          </div>
          <div className="text-[10px] text-slate-400">
            {abuseCount > 0 ? 'Quarantined reports awaiting review' : 'No active quarantine flags'}
          </div>
        </div>
      </div>

      {/* 4. Enterprise Segmented Tab Bar */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none w-full">
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 5. Sub-View Module Container */}
      <div className="mt-2">
        {activeSubTab === 'tenants' && (
          <TenantsView
            tenants={tenants}
            activeTenantId={activeTenantId}
            onSelectTenant={(id) => setActiveTenantId(id)}
            onOpenCreateTenantModal={() => setIsCreateTenantOpen(true)}
            onRefreshTenants={onRefreshTenants}
          />
        )}

        {activeSubTab === 'users' && (
          <UsersView
            onOpenInviteModal={() => setIsInviteUserOpen(true)}
            currentUser={currentUser}
            activeTenantId={activeTenantId}
          />
        )}

        {activeSubTab === 'domains' && (
          <DomainsView
            currentUser={currentUser}
            activeTenantId={activeTenantId}
          />
        )}

        {activeSubTab === 'abuse' && (
          <AbuseView
            onRefreshBadge={onRefreshBadge}
            currentUser={currentUser}
          />
        )}

        {activeSubTab === 'apikeys' && (
          <ApiKeysView
            onOpenCreateKeyModal={() => setIsCreateApiKeyOpen(true)}
            onNavigateToDocs={() => handleTabClick('docs')}
            currentUser={currentUser}
          />
        )}

        {activeSubTab === 'docs' && (
          <ApiDocsView
            onNavigateToApiKeys={() => handleTabClick('apikeys')}
            currentUser={currentUser}
          />
        )}
      </div>

      {/* 6. Modals Managed Directly Inside Settings Workspace */}
      <CreateTenantModal
        isOpen={isCreateTenantOpen}
        onClose={() => setIsCreateTenantOpen(false)}
        onTenantCreated={(newTenant) => {
          clearApiCache('tenants');
          onRefreshTenants();
          if (newTenant && newTenant.id) {
            setActiveTenantId(newTenant.id);
          }
        }}
      />

      <InviteUserModal
        isOpen={isInviteUserOpen}
        onClose={() => setIsInviteUserOpen(false)}
        onUserInvited={() => {
          clearApiCache('users');
        }}
        currentUser={currentUser}
        activeTenantId={activeTenantId}
        tenants={tenants}
      />

      <CreateApiKeyModal
        isOpen={isCreateApiKeyOpen}
        onClose={() => setIsCreateApiKeyOpen(false)}
        onKeyCreated={() => {
          clearApiCache('api-keys');
        }}
      />
    </div>
  );
};
