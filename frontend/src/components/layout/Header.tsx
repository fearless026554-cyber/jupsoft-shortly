'use client';

import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  Search,
  Plus,
  RefreshCw,
  Bell,
  Check,
  Sparkles,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { TenantItem, api } from '../../api';
import { useTenantDomains } from '../../hooks/useTenantDomains';
import { Permissions, getRoleDisplayName } from '../../utils/rbac';

export interface HeaderProps {
  tenants: TenantItem[];
  activeTenantId: string; // 'all' or UUID
  setActiveTenantId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  health: { status: string; services?: { database: string; redis: string } } | null;
  loading: boolean;
  onRefresh: () => void;
  onCreateLinkClick: () => void;
  onOpenCreateTenantModal: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tenants,
  activeTenantId,
  setActiveTenantId,
  searchQuery,
  setSearchQuery,
  health,
  loading,
  onRefresh,
  onCreateLinkClick,
  onOpenCreateTenantModal,
  currentUser,
  onLogout,
}) => {
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { defaultDomain } = useTenantDomains();

  const currentTenant = tenants.find((t) => t.id === activeTenantId);

  return (
    <header className="h-[50px] bg-[#0D233A] border-b border-[#1E3A5F] px-4 flex items-center justify-between shrink-0 shadow-sm text-white select-none z-30">
      {/* Left: Brand & Tenant Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 leading-tight">
              Jupsoft <span className="text-amber-400 font-semibold">Shortly</span>
              <span className="text-[10px] bg-blue-600/70 text-blue-200 px-1 py-0.2 rounded font-mono font-medium">CRM</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{defaultDomain}</span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

        {/* Dynamic Multi-Tenant Switcher Dropdown (Super Admin only for cross-tenant scope) */}
        {Permissions.canSwitchTenants(currentUser?.role) ? (
          <div className="relative">
            <button
              onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
              className="flex items-center gap-2 bg-[#162D4A] hover:bg-[#1A3456] px-2 py-1 rounded border border-[#1E3A5F] text-[11px] font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="max-w-[160px] truncate text-white font-semibold">
                {activeTenantId === 'all'
                  ? 'All Schools'
                  : currentTenant
                  ? `${currentTenant.name} (${currentTenant.code})`
                  : 'Select School'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Tenant Dropdown Menu */}
            {tenantDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-64 bg-white text-slate-800 rounded-lg border border-slate-200 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setTenantDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                  <span>Select Scope</span>
                  <span className="text-blue-600 font-mono font-normal">Super Admin</span>
                </div>

                {/* Global View Option */}
                <button
                  onClick={() => {
                    setActiveTenantId('all');
                    setTenantDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                    activeTenantId === 'all' ? 'bg-blue-50/70 font-bold text-blue-700' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>All Schools</span>
                  </div>
                  {activeTenantId === 'all' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                {/* List of Individual Tenants */}
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => {
                        setActiveTenantId(tenant.id);
                        setTenantDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                        activeTenantId === tenant.id
                          ? 'bg-blue-50/70 font-bold text-blue-700'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate">{tenant.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Code: {tenant.code} · Plan: {tenant.plan_id}
                        </div>
                      </div>
                      {activeTenantId === tenant.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>

                {Permissions.canManageTenants(currentUser?.role) && (
                  <div className="border-t border-slate-100 pt-1 mt-1 px-2">
                    <button
                      onClick={() => {
                        setTenantDropdownOpen(false);
                        onOpenCreateTenantModal();
                      }}
                      className="w-full py-1.5 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-3 h-3" /> Add School
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#162D4A] px-2.5 py-1 rounded border border-[#1E3A5F] text-[11px] text-slate-200">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-semibold truncate max-w-[160px]">
              {currentTenant ? currentTenant.name : (currentUser?.tenant_code ? `School (${currentUser.tenant_code})` : 'Assigned School')}
            </span>
          </div>
        )}

        {/* Live Backend Health Badge */}
        {health && (
          <span className="hidden xl:inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Operational
          </span>
        )}
      </div>

      {/* Center Global Search */}
      <div className="hidden md:flex items-center w-80 relative">
        <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
        <input
          id="zoho-global-search"
          type="text"
          placeholder="Search... (Ctrl + /)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-[#162D4A] border border-[#1E3A5F] rounded-md text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-[#1A3456]"
        />
      </div>

      {/* Right Controls & Actions */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onRefresh}
          className="p-1.5 text-[#CBD5E1] hover:text-white hover:bg-[#162D4A] rounded-md transition"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Primary Action Button - Hidden for read-only role */}
        {Permissions.canCreateLinks(currentUser?.role) && (
          <button
            onClick={onCreateLinkClick}
            aria-label="Create Short Link"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0F6CBD] hover:bg-[#0c599b] text-white text-[10px] font-bold uppercase tracking-wider rounded shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Create Link
          </button>
        )}

        <button
          aria-label="System Notifications"
          title="System Notifications"
          className="p-1.5 text-[#CBD5E1] hover:text-white hover:bg-[#162D4A] rounded-md relative transition"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User Account & Logout Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            aria-label={`User Account: ${currentUser?.name || currentUser?.email || 'User'}`}
            className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center text-xs shadow-inner cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none transition"
            title={`${currentUser?.name || currentUser?.email || 'User'} (${getRoleDisplayName(currentUser?.role)})`}
          >
            {currentUser?.name
              ? currentUser.name
                  .split(' ')
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : currentUser?.email
              ? currentUser.email.slice(0, 2).toUpperCase()
              : 'U'}
          </button>

          {userDropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 bg-white text-slate-800 rounded-lg border border-slate-200 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setUserDropdownOpen(false)}
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-semibold text-xs text-slate-900 truncate">
                  {currentUser?.name || currentUser?.email || 'User'}
                </div>
                {currentUser?.email && (
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {currentUser.email}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                    {getRoleDisplayName(currentUser?.role)}
                  </span>
                  {currentUser?.tenant_code && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-600 bg-slate-100">
                      School: {currentUser.tenant_code}
                    </span>
                  )}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    if (onLogout) {
                      onLogout();
                    } else {
                      api.logout().then(() => {
                        window.location.href = '/login';
                      });
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition cursor-pointer font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Console</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// Backward-compatibility export
export const ZohoHeader = Header;
