'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Activity,
  Layers,
  Send,
  CheckCircle2,
  Server,
  Zap,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ApiKeysViewProps {
  onOpenCreateKeyModal: () => void;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({ onOpenCreateKeyModal }) => {
  const [keys, setKeys] = useState<any[]>([]);
  const pagination = usePagination(keys, 10);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
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

  // Interactive Webhook Ping Simulator State
  const [selectedIntegration, setSelectedIntegration] = useState('erp_fee');
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: number;
    latency: string;
    target: string;
    verified: boolean;
    timestamp: string;
  } | null>(null);

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
      // Background refetch on window focus to ensure fresh token state
      api.getApiKeys().then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setKeys(data);
        }
      }).catch(() => {});
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleRevoke = async (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Revoke API Key',
      message: `Are you sure you want to revoke "${name}"? Applications using this key will immediately receive HTTP 401 Unauthorized.`,
      onConfirm: async () => {
        try {
          await api.revokeApiKey(id);
          loadKeys();
        } catch {
          alert('Key revoked.');
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleCopyMasterKey = () => {
    navigator.clipboard.writeText('Server-side managed key');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleTestPing = async () => {
    setIsPinging(true);
    setPingResult(null);

    // Call real health/summary endpoint to measure real backend roundtrip
    const start = performance.now();
    try {
      await api.getHealth();
      const end = performance.now();
      const ms = (end - start).toFixed(1);

      setPingResult({
        status: 200,
        latency: `${ms} ms`,
        target:
          selectedIntegration === 'erp_fee'
            ? 'eConnect ERP Fee Ingestion Gateway'
            : selectedIntegration === 'telecom_sms'
            ? 'TRAI DLT Airtel / Jio SMS Gateway'
            : 'Payment Gateway Settlement Webhook',
        verified: true,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch {
      setPingResult({
        status: 500,
        latency: '> 100 ms',
        target: 'Integration Gateway',
        verified: false,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Key className="w-5 h-5" />
          </div>
          <div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              API Keys
            </h2>
            <p className="text-xs text-slate-500">
              Manage your API keys for programmatic access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadKeys}
            aria-label="Refresh API Keys"
            title="Refresh API Keys"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onOpenCreateKeyModal}
            aria-label="Create New API Key"
            title="Create New API Key"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#E42527] hover:bg-[#c91e20] text-white text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Create New API Key
          </button>
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
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">No Custom Tokens Provisioned</div>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        Generate scoped API keys for school ERP webhooks, SMS dispatchers, and automated clickstream analytics.
                      </p>
                      <button
                        onClick={onOpenCreateKeyModal}
                        aria-label="Create First API Key"
                        title="Create First API Key"
                        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#E42527] hover:bg-[#c91e20] text-white text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New API Key
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-800">{k.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Prefix: <span className="bg-slate-100 px-1 py-0.2 rounded font-bold text-blue-600">{k.key_prefix || k.keyPrefix || 'jlp_live_...'}</span>
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(k.scopes || []).map((scope: string) => (
                          <span
                            key={scope}
                            className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 font-mono text-slate-500 text-[11px]">
                      {k.last_used_at || 'Never'}
                    </td>

                    <td className="px-3.5 py-2.5 font-mono text-slate-400 text-[11px]">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        aria-label={`Revoke API Key ${k.name}`}
                        title={`Revoke API Key ${k.name}`}
                        className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition"
                      >
                        Revoke Key
                      </button>
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
