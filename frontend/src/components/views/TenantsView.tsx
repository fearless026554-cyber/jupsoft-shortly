'use client';

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  Copy,
} from 'lucide-react';
import { TenantItem, api, exportToCsv } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface TenantsViewProps {
  tenants: TenantItem[];
  activeTenantId: string;
  onSelectTenant: (id: string) => void;
  onOpenCreateTenantModal: () => void;
  onRefreshTenants: () => void;
}

export const TenantsView: React.FC<TenantsViewProps> = ({
  tenants,
  activeTenantId,
  onSelectTenant,
  onOpenCreateTenantModal,
  onRefreshTenants,
}) => {
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {},
  });

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filtered, 10);

  const handleToggleStatus = async (tenant: TenantItem) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active';
    
    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Status Change',
      message: `Are you sure you want to change status of "${tenant.name}" to ${nextStatus.toUpperCase()}?`,
      isDestructive: nextStatus === 'suspended',
      onConfirm: async () => {
        setUpdatingId(tenant.id);
        try {
          await api.updateTenantStatus(tenant.id, nextStatus);
          onRefreshTenants();
        } catch (err: any) {
          alert('Failed to update tenant status: ' + err.message);
        } finally {
          setUpdatingId(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleExport = () => {
    exportToCsv(
      `tenants_directory_${new Date().toISOString().slice(0, 10)}`,
      tenants.map((t) => ({
        TenantID: t.id,
        Code: t.code,
        SchoolName: t.name,
        Plan: t.plan_id,
        Status: t.status,
        CreatedAt: t.created_at,
      }))
    );
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Institutions
              <span className="text-[10px] bg-purple-100 text-purple-800 font-mono px-2 py-0.5 rounded-full font-semibold">
                Super Admin
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage your school branches and subscriptions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Export
          </button>
          <button
            onClick={onOpenCreateTenantModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E42527] hover:bg-[#c91e20] text-white text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Add Institution
          </button>
        </div>
      </div>

      {/* Search & Active Stats Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school name or tenant code..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <span>
            Total: <strong className="text-slate-900 font-mono">{tenants.length}</strong>
          </span>
          <span>·</span>
          <span>
            Active:{' '}
            <strong className="text-emerald-700 font-mono">
              {tenants.filter((t) => t.status === 'active').length}
            </strong>
          </span>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
              <Building2 className="w-7 h-7 text-slate-400" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-bold text-slate-800">
                No Institutions Found
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {search
                  ? `No school tenants match "${search}". Try searching by code or partial name.`
                  : 'Add an institution to start managing their short links.'}
              </p>
            </div>
            {!search && (
              <button
                onClick={onOpenCreateTenantModal}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E42527] hover:bg-[#c91e20] text-white text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Add Institution
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">Institution</th>
                <th className="px-3.5 py-2.5">Code</th>
                <th className="px-3.5 py-2.5">Plan</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5">Added</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {pagination.isLazyLoading ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-6">
                    <TableSkeleton rows={pagination.pageSize} columns={6} />
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((tenant) => {
                const isSelected = activeTenantId === tenant.id;
                const initials = tenant.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <tr
                    key={tenant.id}
                    className={`hover:bg-slate-50/70 transition ${
                      isSelected ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {initials || 'SC'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{tenant.name}</span>
                            {isSelected && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold font-mono">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <span>ID: {tenant.id.slice(0, 18)}...</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tenant.id);
                              }}
                              aria-label="Copy Tenant ID"
                              title="Copy Tenant ID"
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3.5 py-3 font-mono font-bold text-blue-600">
                      /{tenant.code}
                    </td>

                    <td className="px-3.5 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase">
                        {tenant.plan_id.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-3.5 py-3">
                      {tenant.status === 'active' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" /> Suspended
                        </span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-3.5 py-3 text-right space-x-1.5">
                      <button
                        onClick={() => onSelectTenant(tenant.id)}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                      >
                        Switch
                      </button>

                      <button
                        onClick={() => handleToggleStatus(tenant)}
                        disabled={updatingId === tenant.id}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                          tenant.status === 'active'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {tenant.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={filtered.length}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="schools"
            />
          )}
        </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Confirm"
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
