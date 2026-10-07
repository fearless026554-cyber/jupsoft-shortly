'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Permissions } from '../../utils/rbac';

interface ApiKeysViewProps {
  onOpenCreateKeyModal: () => void;
  currentUser?: any;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({ onOpenCreateKeyModal, currentUser }) => {
  const [keys, setKeys] = useState<any[]>([]);
  const pagination = usePagination(keys, 10);
  const [loading, setLoading] = useState(true);
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

  const loadKeys = async () => {
    setLoading(true);
    try {
      const data = await api.getApiKeys();
      setKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load keys:', err);
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();

    const onFocus = () => {
      api.getApiKeys().then((data) => {
        if (Array.isArray(data)) {
          setKeys(data);
        }
      }).catch(() => {});
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleRevoke = async (id: string, name: string, prefix?: string) => {
    const keyPrefix = prefix || 'jlp_live_...';
    setConfirmConfig({
      isOpen: true,
      title: 'Revoke API Key',
      message: `Are you sure you want to revoke key "${name}" (prefix: ${keyPrefix})? Applications using this key will immediately receive HTTP 401 Unauthorized.`,
      onConfirm: async () => {
        try {
          await api.revokeApiKey(id);
          setKeys((prev) => prev.filter((k) => k.id !== id));
          loadKeys();
        } catch {
          // handled
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const maskPrefix = (rawPrefix?: string) => {
    const p = rawPrefix || 'jlp_live_...';
    if (p.length > 12) {
      return `${p.slice(0, 9)}••••${p.slice(-4)}`;
    }
    return p;
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Developer API Keys
            </h1>
            <p className="text-xs text-slate-500">
              Manage your API keys for programmatic access and ERP integrations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadKeys}
            aria-label="Refresh API Keys"
            title="Refresh API Keys"
            className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {Permissions.canManageApiKeys(currentUser?.role) && (
            <button
              onClick={onOpenCreateKeyModal}
              aria-label="Create New API Key"
              title="Create New API Key"
              className="min-h-[36px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create API Key
            </button>
          )}
        </div>
      </div>

      {/* Provisioned Keys Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <span>Custom API Keys</span>
            {loading ? (
              <span className="inline-block w-8 h-3.5 bg-slate-200 animate-pulse rounded" />
            ) : (
              <span className="font-mono text-slate-500">({keys.length})</span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Securely Stored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">Key Name & Prefix</th>
                <th className="px-3.5 py-2.5">Authorized Scopes</th>
                <th className="px-3.5 py-2.5">Last Invocation</th>
                <th className="px-3.5 py-2.5">Created Date</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3.5 py-3">
                      <div className="h-4 bg-slate-200 rounded w-44 mb-1.5"></div>
                      <div className="h-3 bg-slate-100 rounded w-28"></div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex gap-1">
                        <div className="h-4 bg-slate-100 rounded w-16"></div>
                        <div className="h-4 bg-slate-100 rounded w-16"></div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 bg-slate-100 rounded w-20"></div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 bg-slate-100 rounded w-24"></div>
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <div className="h-6 bg-slate-100 rounded w-20 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : pagination.isLazyLoading ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6">
                    <TableSkeleton rows={pagination.pageSize} columns={5} />
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                /* Empty state: Single CTA policy (no duplicate Create Key button) */
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">No Custom Tokens Provisioned</div>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        Generate scoped API keys from the header button for webhooks, SMS dispatchers, and automated clickstream analytics.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-800">{k.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Prefix: <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium text-slate-700">{maskPrefix(k.key_prefix || k.keyPrefix)}</span>
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5">
                      {(!k.scopes || k.scopes.length === 0) ? (
                        <span className="text-slate-400 text-xs">No scopes</span>
                      ) : k.scopes.length <= 2 ? (
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((scope: string) => (
                            <span
                              key={scope}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                            {k.scopes.length} scopes ({k.scopes.slice(0, 2).join(', ')} +{k.scopes.length - 2} more)
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5 font-mono text-slate-500 text-[11px]">
                      {k.last_used_at || 'Never'}
                    </td>

                    <td className="px-3.5 py-2.5 font-mono text-slate-400 text-[11px]">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      {Permissions.canManageApiKeys(currentUser?.role) && (
                        <button
                          onClick={() => handleRevoke(k.id, k.name, k.key_prefix || k.keyPrefix)}
                          aria-label={`Revoke API Key ${k.name}`}
                          title={`Revoke API Key ${k.name}`}
                          className="min-h-[40px] px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition cursor-pointer"
                        >
                          Revoke Key
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {keys.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={keys.length}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="API keys"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Revoke Key"
        isDestructive={true}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
