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
  Lock,
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
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
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
        setMessage({
          type: 'success',
          text: `Domain "${newHostname}" added. Next: add the CNAME at your DNS provider, then verify DNS.`,
        });
        setNewHostname('');
        await loadDomains();
      } else {
        setMessage({
          type: 'error',
          text: res.error?.message || 'Failed to register domain.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Network error while adding domain.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleVerifyDomain = async (id: string, hostname: string) => {
    setVerifyingId(id);
    setMessage(null);
    try {
      const res = await api.verifyDomain(id);
      if (res.success) {
        setDomains((prev) =>
          prev.map((d) => (d.id === id ? { ...d, verification_status: 'verified', ssl_active: true } : d))
        );
        setMessage({
          type: 'success',
          text: `DNS verification successful for ${hostname}. Status: verified.`,
        });
      } else {
        setDomains((prev) =>
          prev.map((d) => (d.id === id ? { ...d, verification_status: 'failed' } : d))
        );
        setMessage({
          type: 'error',
          text: res.error?.message || `Failed to verify CNAME for ${hostname}. Status: failed.`,
        });
      }
    } catch (err: any) {
      setDomains((prev) =>
        prev.map((d) => (d.id === id ? { ...d, verification_status: 'failed' } : d))
      );
      setMessage({
        type: 'error',
        text: err.message || `Network error while verifying ${hostname}. Status: failed.`,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (domains.length === 0) return;
    setIsVerifyingAll(true);
    setMessage(null);

    try {
      let anyFailed = false;
      for (const dom of domains) {
        try {
          const res = await api.verifyDomain(dom.id);
          if (res.success) {
            setDomains((prev) =>
              prev.map((d) => (d.id === dom.id ? { ...d, verification_status: 'verified', ssl_active: true } : d))
            );
          } else {
            anyFailed = true;
            setDomains((prev) =>
              prev.map((d) => (d.id === dom.id ? { ...d, verification_status: 'failed' } : d))
            );
          }
        } catch {
          anyFailed = true;
          setDomains((prev) =>
            prev.map((d) => (d.id === dom.id ? { ...d, verification_status: 'failed' } : d))
          );
        }
      }

      if (anyFailed) {
        setMessage({
          type: 'error',
          text: 'DNS verification completed. Check per-domain status below for records requiring attention.',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'All custom domains successfully verified. SSL provisioning is active.',
        });
      }
    } finally {
      setIsVerifyingAll(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner with Single H1 */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Custom Domains
            </h1>
            <p className="text-xs text-slate-500">
              Manage branded short link domains and DNS verification.
            </p>
          </div>
        </div>

        <button
          onClick={loadDomains}
          aria-label="Refresh custom domains"
          title="Refresh custom domains"
          className="min-h-[40px] px-3 py-1.5 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition inline-flex items-center gap-1.5"
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

      {/* Numbered DNS Setup Steps (1 Add domain, 2 Add the CNAME at your DNS provider, 3 Verify DNS) */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              DNS Setup Checklist
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete these 3 numbered steps to connect and activate your branded domain.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {domains.length} {domains.length === 1 ? 'Domain' : 'Domains'} Added
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1: Add domain */}
          <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">1</span>
                  Add domain
                </span>
                {domains.length > 0 && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mb-2.5">
                Register your school subdomain (e.g. <span className="font-mono text-blue-600 font-semibold">link.myschool.edu.in</span>).
              </p>

              {Permissions.canManageDomains(currentUser?.role) && (
                <form onSubmit={handleAddDomain} className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newHostname}
                    onChange={(e) => setNewHostname(e.target.value)}
                    placeholder="e.g. link.hillwoods.edu.in"
                    className="w-full h-9 text-xs px-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
                  />
                  <button
                    type="submit"
                    disabled={isAdding || !newHostname.trim()}
                    className="w-full h-9 flex items-center justify-center gap-1.5 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isAdding ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Adding Domain...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> 1. Add Domain
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Step 2: Add the CNAME at your DNS provider */}
          <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">2</span>
                  Add the CNAME at your DNS provider
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2.5">
                Add this DNS record in Cloudflare, GoDaddy, or your DNS provider:
              </p>

              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">Record Type:</span>
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">CNAME</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">Points To:</span>
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">cname.jup.link</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              TTL: Automatic or 300s. Propagation takes ~2–10 minutes.
            </p>
          </div>

          {/* Step 3: Verify DNS */}
          <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">3</span>
                  Verify DNS
                </span>
                {domains.some((d) => d.verification_status === 'verified') && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mb-2.5">
                Check DNS propagation and trigger automatic SSL certificate provisioning.
              </p>

              <button
                type="button"
                disabled={domains.length === 0 || isVerifyingAll}
                onClick={handleVerifyAll}
                className="w-full h-9 flex items-center justify-center gap-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {isVerifyingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Records...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 3. Verify DNS
                  </>
                )}
              </button>
            </div>

            {domains.length === 0 ? (
              <p className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                Verify disabled until Step 1 (Add domain) is completed.
              </p>
            ) : (
              <p className="text-[11px] text-emerald-700 font-medium">
                Step 1 completed. Click above to verify DNS records across domains.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Domains Table with Live Status Text */}
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
          /* Empty state: Single CTA policy (no duplicate Add Domain button) */
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <Globe className="w-7 h-7 text-blue-600" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-sm font-bold text-slate-800">
                No Custom Domains Connected
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use Step 1 above to register your school domain (e.g. <code className="text-blue-600 font-mono font-semibold">link.yourdomain.com</code>).
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Hostname</th>
                  <th className="px-3.5 py-2.5">Domain Type</th>
                  <th className="px-3.5 py-2.5">DNS Status</th>
                  <th className="px-3.5 py-2.5">DLT Whitelist</th>
                  <th className="px-3.5 py-2.5">SSL Status</th>
                  <th className="px-3.5 py-2.5 text-right">Step 3 Action</th>
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
                  pagination.paginatedItems.map((dom) => {
                    const status = (dom.verification_status || 'pending').toLowerCase();
                    return (
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

                        {/* Live per-domain status text: pending / verified / failed */}
                        <td className="px-3.5 py-2.5">
                          {status === 'verified' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] flex items-center gap-1 w-fit font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> verified
                            </span>
                          ) : status === 'failed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold text-[10px] flex items-center gap-1 w-fit font-mono">
                              <AlertCircle className="w-3 h-3 text-red-600" /> failed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] flex items-center gap-1 w-fit font-mono">
                              <Clock className="w-3 h-3 text-amber-600" /> pending
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
                              disabled={verifyingId === dom.id}
                              aria-label={`Verify DNS for ${dom.hostname}`}
                              title={`Verify DNS for ${dom.hostname}`}
                              className="min-h-[40px] px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                            >
                              {verifyingId === dom.id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Verifying...
                                </>
                              ) : (
                                'Verify DNS'
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-500 text-xs font-mono">{status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
