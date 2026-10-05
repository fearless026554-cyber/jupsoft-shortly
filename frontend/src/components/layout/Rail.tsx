'use client';

import React from 'react';
import {
  LayoutDashboard,
  Link2,
  DollarSign,
  QrCode,
  BarChart3,
  Building2,
  Users,
  Globe,
  ShieldAlert,
  Key,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

import { Permissions } from '../../utils/rbac';

export type ActiveModule =
  | 'overview'
  | 'links'
  | 'bulk'
  | 'outcomes'
  | 'qr'
  | 'analytics'
  | 'tenants'
  | 'users'
  | 'domains'
  | 'abuse'
  | 'apikeys'
  | 'help';

interface RailProps {
  activeTab: ActiveModule;
  setActiveTab: (tab: ActiveModule) => void;
  linksCount: number;
  abuseCount: number;
  currentUser?: any;
}

export const Rail: React.FC<RailProps> = ({
  activeTab,
  setActiveTab,
  linksCount,
  abuseCount,
  currentUser,
}) => {
  const userRole = currentUser?.role;

  const allNavItems: {
    id: ActiveModule;
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | null;
    visible: boolean;
  }[] = [
    { id: 'overview', path: '/', label: 'Home', icon: LayoutDashboard, visible: true },
    { id: 'links', path: '/links', label: 'Links', icon: Link2, badge: linksCount > 0 ? linksCount : null, visible: true },
    { id: 'bulk', path: '/bulk', label: 'Bulk CSV', icon: FileSpreadsheet, visible: Permissions.canBulkCreate(userRole) },
    { id: 'outcomes', path: '/outcomes', label: 'Outcomes', icon: DollarSign, visible: true },
    { id: 'qr', path: '/qr', label: 'QR Codes', icon: QrCode, visible: true },
    { id: 'analytics', path: '/reports', label: 'Reports', icon: BarChart3, visible: true },
    { id: 'tenants', path: '/tenants', label: 'Tenants', icon: Building2, visible: Permissions.canManageTenants(userRole) },
    { id: 'users', path: '/users', label: 'Users', icon: Users, visible: Permissions.canViewUsers(userRole) },
    { id: 'domains', path: '/domains', label: 'Domains', icon: Globe, visible: Permissions.canManageDomains(userRole) },
    { id: 'abuse', path: '/abuse', label: 'Abuse', icon: ShieldAlert, badge: abuseCount > 0 ? abuseCount : null, visible: Permissions.canManageAbuse(userRole) },
    { id: 'apikeys', path: '/apikeys', label: 'API Keys', icon: Key, visible: Permissions.canManageApiKeys(userRole) },
  ];

  const navItems = allNavItems.filter((item) => item.visible);

  const handleNavClick = (e: React.MouseEvent, id: ActiveModule, path: string) => {
    e.preventDefault();
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
    }
  };

  return (
    <aside className="w-16 h-full bg-[#0d1527] border-r border-slate-800 flex flex-col justify-between items-center py-2 z-20 shrink-0 select-none">
      {/* Top Brand Logo */}
      <div className="flex flex-col items-center mb-1.5">
        <a
          href="/"
          onClick={(e) => handleNavClick(e, 'overview', '/')}
          aria-label="Jupsoft Shortly Home"
          className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center p-1 transition-transform hover:scale-105 border border-slate-700/60 shadow-sm cursor-pointer overflow-hidden"
          title="Jupsoft Shortly"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/jupsoft-logo.png"
            alt="Jupsoft Logo"
            className="w-full h-full object-contain"
          />
        </a>
      </div>

      {/* Primary Semantic Links Navigation Rail (Solves G3: Real routes & semantic links) */}
      <nav className="flex-1 w-full flex flex-col items-center space-y-0.5 overflow-y-auto overflow-x-hidden py-1" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <a
              key={item.id}
              href={item.path}
              onClick={(e) => handleNavClick(e, item.id, item.path)}
              aria-label={`${item.label} Module`}
              title={item.label}
              className={`relative w-full h-[50px] flex flex-col items-center justify-center transition-all group ${
                isActive
                  ? 'bg-slate-800/90 text-white font-bold'
                  : 'text-[#CBD5E1] hover:text-white hover:bg-slate-800/40'
              }`}
            >
              {/*  Active Left Indicator Bar */}
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-1 bg-blue-500 rounded-r-sm" />
              )}

              <div className="relative">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-blue-400' : 'text-[#CBD5E1] group-hover:text-white'
                  }`}
                />
                {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-blue-500 text-white text-[8px] font-mono font-bold flex items-center justify-center leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] tracking-tight mt-1 font-medium transition-colors ${
                  isActive
                    ? 'text-blue-400 font-bold'
                    : 'text-[#CBD5E1] group-hover:text-white'
                }`}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

      {/* Bottom Help Semantic Link (Solves G3 and Help P0) */}
      <div className="w-full flex flex-col items-center pt-1.5 border-t border-slate-800/80 shrink-0 mt-auto">
        <a
          href="/help"
          onClick={(e) => handleNavClick(e, 'help', '/help')}
          aria-label="Help"
          title="Help"
          className={`w-full h-[48px] flex flex-col items-center justify-center transition-colors group ${
            activeTab === 'help'
              ? 'bg-slate-800/90 text-blue-400 font-bold'
              : 'text-[#CBD5E1] hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <HelpCircle className="w-4 h-4 transition-transform group-hover:scale-110 text-[#CBD5E1] group-hover:text-blue-400" />
          <span className="text-[10px] tracking-tight mt-1 font-medium text-[#CBD5E1] group-hover:text-blue-400">
            Help
          </span>
        </a>
      </div>
    </aside>
  );
};
