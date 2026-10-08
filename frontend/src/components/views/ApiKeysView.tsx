'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  RefreshCw,
  Activity,
  Zap,
  X,
  User,
  ShieldCheck,
  ShieldAlert,
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

  // Rate limit editing state for Super Admin
  const [editingKey, setEditingKey] = useState<any | null>(null);
  const [editLimitVal, setEditLimitVal] = useState<number>(10);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const isSuperAdmin = currentUser?.role === 'super_admin';

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

  const handleOpenEditLimit = (k: any) => {
    setEditingKey(k);
    setEditLimitVal(k.rate_limit_rpm || 10);
    setEditError(null);
  };

  const handleSaveRateLimit = async () => {
    if (!editingKey) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await api.updateApiKeyRateLimit(editingKey.id, editLimitVal);
      if (res.success) {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === editingKey.id ? { ...k, rate_limit_rpm: editLimitVal } : k
          )
        );
        setEditingKey(null);
      } else {
        setEditError(res.error?.message || 'Failed to update rate limit');
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleRevoke = async (id: string, name: string, prefix?: string) => {
    const keyPrefix = prefix || 'jlp_live_...';
    setConfirmConfig({
      isOpen: true,
      title: 'Revoke API Key',
      message: `Are you sure you want to revoke key "${name}" (prefix: ${keyPrefix})? Applications using this key will immediately receive HTTP 401 Unauthorized.`,
      onConfirm: async () => {
        try {
          await api.revokeApiKey(id);
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
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-900">
                Developer API Keys & Governance
              </h1>
              {isSuperAdmin && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Super Admin Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Manage keys, monitor usage calls, and enforce dynamic per-minute rate limits.
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
            <span>Provisioned Keys & Governance</span>
            {loading ? (
              <span className="inline-block w-8 h-3.5 bg-slate-200 animate-pulse rounded" />
            ) : (
              <span className="font-mono text-slate-500">({keys.length})</span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Default: 10 req/min
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">Key Name & Prefix</th>
                <th className="px-3.5 py-2.5">Created By</th>
                <th className="px-3.5 py-2.5">Authorized Scopes</th>
                <th className="px-3.5 py-2.5">Total Invocations</th>
                <th className="px-3.5 py-2.5">Rate Limit</th>
                <th className="px-3.5 py-2.5">Last Invocation</th>
                <th className="px-3.5 py-2.5">Created Date</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3.5 py-3">
                      <div className="h-4 bg-slate-200 rounded w-44 mb-1.5"></div>
                      <div className="h-3 bg-slate-100 rounded w-28"></div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 bg-slate-100 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-slate-50 rounded w-32"></div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex gap-1">
                        <div className="h-4 bg-slate-100 rounded w-16"></div>
                        <div className="h-4 bg-slate-100 rounded w-16"></div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-4 bg-slate-100 rounded w-16"></div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-4 bg-slate-100 rounded w-20"></div>
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
                  <td colSpan={8} className="px-3.5 py-6">
                    <TableSkeleton rows={pagination.pageSize} columns={8} />
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">No Custom Tokens Provisioned</div>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        Generate scoped API keys from the header button for webhooks, ERP synchronizers, and REST integrations.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/80 transition">
                    {/* Key Name & Prefix */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{k.name}</span>
                        {k.revoked_at && (
                          <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-bold text-[9px] uppercase tracking-wider">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Prefix: <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium text-slate-700">{maskPrefix(k.key_prefix || k.keyPrefix)}</span>
                      </div>
                    </td>

                    {/* Created By */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1 text-slate-800 font-medium">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{k.created_by || 'Admin'}</span>
                      </div>
                      {k.created_by_email && (
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                          {k.created_by_email}
                        </div>
                      )}
                    </td>

                    {/* Scopes */}
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

                    {/* Total Invocations */}
                    <td className="px-3.5 py-2.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px] font-semibold">
                        <Activity className="w-3 h-3 text-emerald-600" />
                        <span>{k.total_calls || 0} calls</span>
                      </div>
                    </td>

                    {/* Rate Limit */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {k.rate_limit_rpm || 10} req/min
                        </span>
                        {isSuperAdmin && !k.revoked_at && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditLimit(k)}
                            aria-label={`Edit rate limit for ${k.name}`}
                            title="Super Admin: Edit Rate Limit"
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Last Invocation */}
                    <td className="px-3.5 py-2.5 font-mono text-slate-500 text-[11px]">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </td>

                    {/* Created Date */}
                    <td className="px-3.5 py-2.5 font-mono text-slate-400 text-[11px]">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2.5 text-right">
                      {k.revoked_at ? (
                        <div className="text-[10px] text-slate-400 text-right">
                          <span className="font-semibold text-red-600 block">Revoked</span>
                          {k.revoked_by && <span>by {k.revoked_by}</span>}
                        </div>
                      ) : (
                        Permissions.canManageApiKeys(currentUser?.role) && (
                          <button
                            onClick={() => handleRevoke(k.id, k.name, k.key_prefix || k.keyPrefix)}
                            aria-label={`Revoke API Key ${k.name}`}
                            title={`Revoke API Key ${k.name}`}
                            className="min-h-[32px] px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition cursor-pointer"
                          >
                            Revoke
                          </button>
                        )
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

      {/* Super Admin Rate Limit Edit Modal */}
      {editingKey && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="h-12 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-100 flex items-center justify-center text-amber-600">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs text-slate-800">
                  Change Rate Limit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block">Target Key:</span>
                <span className="font-bold text-slate-800 text-xs">{editingKey.name}</span>
                <span className="text-[10px] font-mono text-slate-400 ml-1">({maskPrefix(editingKey.key_prefix)})</span>
              </div>

              {editError && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  {editError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Requests Per Minute (RPM)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  required
                  value={editLimitVal}
                  onChange={(e) => setEditLimitVal(Math.max(1, parseInt(e.target.value, 10) || 10))}
                  className="w-full text-xs px-3 py-2 rounded border border-slate-300 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Default: 10 req/min. Adjust limit up or down dynamically in real time.
                </p>
              </div>

              {/* Presets */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Quick Presets
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 60, 300, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditLimitVal(preset)}
                      className={`py-1 text-[11px] font-mono rounded border transition ${
                        editLimitVal === preset
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {preset}/m
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 text-xs hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={handleSaveRateLimit}
                  className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs disabled:opacity-50 transition cursor-pointer"
                >
                  {editSaving ? 'Updating...' : 'Update Limit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
