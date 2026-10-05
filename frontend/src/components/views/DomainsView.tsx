'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react';
import { DomainItem, api } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { Permissions } from '../../utils/rbac';

interface DomainsViewProps {
  currentUser?: any;
}

export const DomainsView: React.FC<DomainsViewProps> = ({ currentUser }) => {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHostname, setNewHostname] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pagination = usePagination(domains, 10);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const data = await api.getDomains();
      setDomains(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load domains:', err);
      setDomains([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostname.trim()) return;
    setIsAdding(true);
    setMessage(null);

    try {
      const res = await api.createDomain({
        hostname: newHostname.trim().toLowerCase(),
        type: 'custom',
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Domain "${newHostname}" registered. Please configure your DNS CNAME to cname.jup.link.` });
        setNewHostname('');
        loadDomains();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Failed to register domain.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error while adding domain.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleVerifyDomain = async (id: string, hostname: string) => {
    setMessage(null);
    try {
      const res = await api.verifyDomain(id);
      if (res.success) {
        setMessage({ type: 'success', text: `DNS verification successful for ${hostname}. SSL certificate is being provisioned.` });
        loadDomains();
      } else {
        setMessage({ type: 'error', text: res.error?.message || `Failed to verify CNAME for ${hostname}. Please check your DNS settings.` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error while verifying domain.' });
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Custom Domains
            </h2>
            <p className="text-xs text-slate-500">
              Manage your custom domains.
            </p>
          </div>
        </div>

        <button
          onClick={loadDomains}
          aria-label="Refresh custom domains"
          title="Refresh custom domains"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Domain Registration & CNAME Setup Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Add Domain Form (Visible to Admins only) */}
        {Permissions.canManageDomains(currentUser?.role) && (
          <div className="lg:col-span-5 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                Add Custom Domain
              </span>
            </div>

            <form onSubmit={handleAddDomain} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Hostname
                </label>
                <input
                  type="text"
                  required
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  placeholder="e.g. link.hillwoods.edu.in"
                  className="w-full h-10 text-xs px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isAdding || !newHostname.trim()}
                className="w-full h-10 flex items-center justify-center gap-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isAdding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Add Domain
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <div className={`${Permissions.canManageDomains(currentUser?.role) ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Domain Setup Guide
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">CNAME Record</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 text-xs font-mono">cname.jup.link</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">CNAME</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domains Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-slate-200 rounded w-40" />
                    <div className="h-3 bg-slate-100 rounded w-24" />
                  </div>
                </div>
                <div className="h-5 bg-slate-100 rounded w-20" />
                <div className="h-5 bg-slate-100 rounded w-24" />
                <div className="h-6 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : domains.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <Globe className="w-7 h-7 text-blue-600" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-sm font-bold text-slate-800">
                No Custom Domains Connected
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect your custom domain (e.g., <code className="text-blue-600 font-mono font-semibold">link.yourdomain.com</code>) to use branded short links.
              </p>
            </div>



            <button
              onClick={() => {
                const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                if (input) input.focus();
              }}
              aria-label="Connect School Domain"
              className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Connect School Domain
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Hostname</th>
                  <th className="px-3.5 py-2.5">Domain Type</th>
                  <th className="px-3.5 py-2.5">DNS Verification</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">SSL</th>
                  <th className="px-3.5 py-2.5 text-right">Step 2: CNAME &rarr; Step 3: Verify</th>
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
                  pagination.paginatedItems.map((dom) => (
                  <tr key={dom.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      {dom.hostname}
                    </td>

                    <td className="px-3.5 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] uppercase font-semibold">
                        {dom.type}
                      </span>
                    </td>

                    <td className="px-3.5 py-2.5">
                      {dom.verification_status === 'verified' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> CNAME Verified
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> Pending DNS
                        </span>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5">
                      {dom.dlt_status === 'whitelisted' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                          <ShieldCheck className="w-3 h-3" /> Whitelisted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px] flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> {dom.dlt_status}
                        </span>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5">
                      {dom.ssl_active ? (
                        <span className="text-emerald-700 flex items-center gap-1 font-medium text-[11px]">
                          <Lock className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Provisioning...</span>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      {Permissions.canManageDomains(currentUser?.role) ? (
                        <button
                          onClick={() => handleVerifyDomain(dom.id, dom.hostname)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                        >
                          Verify DNS
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">{dom.verification_status}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {domains.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={domains.length}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="domains"
            />
          )}
        </div>
        )}
      </div>
    </div>
  );
};
