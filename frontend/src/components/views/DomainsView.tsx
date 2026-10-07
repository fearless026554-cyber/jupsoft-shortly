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
  Copy,
  Check,
  Trash2,
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pagination = usePagination(domains, 10);

  const activeDomain = domains[0] || null;
  const serverIp = activeDomain?.server_ip || '122.176.33.17';
  const txtToken = activeDomain?.txt_token || 'shortly-verify=0bb05033';

  const copyValue = (key: string, val: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
          text: `Domain "${newHostname.trim().toLowerCase()}" added. Next: configure your DNS record in Step 2, then click Verify DNS in Step 3.`,
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
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  ...(res.data || {}),
                  verification_status: 'verified',
                  dlt_status: 'whitelisted',
                  ssl_active: true,
                }
              : d
          )
        );
        setMessage({
          type: 'success',
          text: `Live DNS verified for ${hostname} (${res.matchedBy || 'matched'}). Domain is now active!`,
        });
      } else {
        setDomains((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  verification_status: 'failed',
                  ssl_active: false,
                  live_dns: res.liveDns || d.live_dns,
                }
              : d
          )
        );
        setMessage({
          type: 'error',
          text: res.error?.message || `DNS verification failed for ${hostname}.`,
        });
      }
    } catch (err: any) {
      setDomains((prev) =>
        prev.map((d) => (d.id === id ? { ...d, verification_status: 'failed' } : d))
      );
      setMessage({
        type: 'error',
        text: err.message || `Network error while verifying ${hostname}.`,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteDomain = async (id: string, hostname: string) => {
    setDeletingId(id);
    setMessage(null);
    try {
      const res = await api.deleteDomain(id);
      if (res.success) {
        setDomains((prev) => prev.filter((d) => d.id !== id));
        setMessage({
          type: 'success',
          text: `Removed domain ${hostname}.`,
        });
      } else {
        setMessage({
          type: 'error',
          text: res.error?.message || `Failed to remove ${hostname}.`,
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || `Error removing ${hostname}.`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (domains.length === 0) return;
    setIsVerifyingAll(true);
    setMessage(null);

    try {
      let lastError = '';
      let anyFailed = false;
      for (const dom of domains) {
        try {
          const res = await api.verifyDomain(dom.id);
          if (res.success) {
            setDomains((prev) =>
              prev.map((d) =>
                d.id === dom.id
                  ? {
                      ...d,
                      ...(res.data || {}),
                      verification_status: 'verified',
                      dlt_status: 'whitelisted',
                      ssl_active: true,
                    }
                  : d
              )
            );
          } else {
            anyFailed = true;
            lastError = res.error?.message || lastError;
            setDomains((prev) =>
              prev.map((d) =>
                d.id === dom.id
                  ? {
                      ...d,
                      verification_status: 'failed',
                      ssl_active: false,
                      live_dns: res.liveDns || d.live_dns,
                    }
                  : d
              )
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
          text: lastError || 'Live DNS verification failed. Update your DNS records in Step 2 and try again.',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'All custom domains verified against live DNS!',
        });
      }
    } finally {
      setIsVerifyingAll(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header Banner */}
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
              Connect and verify your custom domain via live authoritative DNS lookup.
            </p>
          </div>
        </div>

        <button
          onClick={loadDomains}
          aria-label="Refresh custom domains"
          title="Refresh custom domains"
          className="min-h-[36px] px-3 py-1.5 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Live DNS
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

      {/* 3-Step Live DNS Setup */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Live DNS Setup Checklist
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete these 3 steps to point and verify your domain against live DNS.
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
                Register your custom domain (e.g. <span className="font-mono text-blue-600 font-semibold">helloworld.2bd.net</span>).
              </p>

              {Permissions.canManageDomains(currentUser?.role) && (
                <form onSubmit={handleAddDomain} className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newHostname}
                    onChange={(e) => setNewHostname(e.target.value)}
                    placeholder="e.g. helloworld.2bd.net"
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

          {/* Step 2: Configure Real DNS at Provider */}
          <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">2</span>
                  Set DNS Record (Same for all domains)
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2">
                In your DNS provider&apos;s <strong>Edit DNS</strong> panel, point your domain or subdomain to this server:
              </p>

              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2 text-xs">
                {/* Root Domain / Any Domain: A Record */}
                <div className="space-y-1 pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 font-semibold">For Root / Any Domain:</span>
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Type: A</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Points To (Server IP):</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                        {serverIp}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyValue('ip', serverIp)}
                        title="Copy Server IP"
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                      >
                        {copiedField === 'ip' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subdomain: CNAME Record */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 font-semibold">For Subdomain (Optional):</span>
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Type: CNAME</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Points To:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {activeDomain?.hostname || 'helloworld.2bd.net'}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyValue('cname', activeDomain?.hostname || 'helloworld.2bd.net')}
                        title="Copy CNAME Target"
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                      >
                        {copiedField === 'cname' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {activeDomain?.live_dns && (
              <div className="text-[11px] font-mono px-2 py-1 rounded bg-slate-100 text-slate-600 flex items-center justify-between">
                <span>Live DNS ({activeDomain.hostname}):</span>
                <span className="font-bold text-slate-800">
                  {activeDomain.live_dns.aRecords?.length
                    ? `A → ${activeDomain.live_dns.aRecords[0]}`
                    : activeDomain.live_dns.cnameRecords?.length
                    ? `CNAME → ${activeDomain.live_dns.cnameRecords[0]}`
                    : 'No record'}
                </span>
              </div>
            )}
          </div>

          {/* Step 3: Verify DNS */}
          <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">3</span>
                  Verify Live DNS
                </span>
                {domains.some((d) => d.verification_status === 'verified') && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mb-2.5">
                Queries your domain&apos;s authoritative nameserver live to verify the A or CNAME record.
              </p>

              <button
                type="button"
                disabled={domains.length === 0 || isVerifyingAll}
                onClick={handleVerifyAll}
                className="w-full h-9 flex items-center justify-center gap-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {isVerifyingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking Live DNS...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 3. Verify DNS Now
                  </>
                )}
              </button>
            </div>

            {domains.length === 0 ? (
              <p className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                Complete Step 1 (Add domain) first.
              </p>
            ) : domains.every((d) => d.verification_status === 'verified') ? (
              <p className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                Live DNS verified! Short links now use {activeDomain?.hostname}.
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                Point A record to {serverIp} in Step 2, then click Verify DNS Now.
              </p>
            )}
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
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <Globe className="w-7 h-7 text-blue-600" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-sm font-bold text-slate-800">
                No Custom Domains Connected
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use Step 1 above to register your custom domain (e.g. <code className="text-blue-600 font-mono font-semibold">helloworld.2bd.net</code>).
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Hostname</th>
                  <th className="px-3.5 py-2.5">What to Set in DNS</th>
                  <th className="px-3.5 py-2.5">Current Live DNS</th>
                  <th className="px-3.5 py-2.5">DNS Status</th>
                  <th className="px-3.5 py-2.5">SSL Status</th>
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
                  pagination.paginatedItems.map((dom) => {
                    const status = (dom.verification_status || 'pending').toLowerCase();
                    const currentA = dom.live_dns?.aRecords?.[0];
                    const currentCname = dom.live_dns?.cnameRecords?.[0];
                    const targetIp = dom.server_ip || serverIp;
                    const isIpMatch = currentA === targetIp;
                    return (
                      <tr key={dom.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          {dom.hostname}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700">
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <span>A Record → <strong>{targetIp}</strong></span>
                            <button
                              type="button"
                              onClick={() => copyValue(`row-${dom.id}`, targetIp)}
                              title="Copy IP"
                              className="text-slate-500 hover:text-blue-600 cursor-pointer"
                            >
                              {copiedField === `row-${dom.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 font-mono text-[11px]">
                          {currentA ? (
                            <span
                              className={`px-2 py-0.5 rounded font-semibold ${
                                isIpMatch
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              A → {currentA}
                            </span>
                          ) : currentCname ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                              CNAME → {currentCname}
                            </span>
                          ) : (
                            <span className="text-slate-400">Not resolved</span>
                          )}
                        </td>

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
                          {dom.ssl_active ? (
                            <span className="text-emerald-700 flex items-center gap-1 font-medium text-[11px]">
                              <Lock className="w-3 h-3 text-emerald-600" /> Active
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Pending Verify</span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 text-right">
                          {Permissions.canManageDomains(currentUser?.role) ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleVerifyDomain(dom.id, dom.hostname)}
                                disabled={verifyingId === dom.id}
                                className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                              >
                                {verifyingId === dom.id ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
                                  </>
                                ) : (
                                  'Verify DNS'
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteDomain(dom.id, dom.hostname)}
                                disabled={deletingId === dom.id}
                                title={`Remove ${dom.hostname}`}
                                className="h-8 px-2 rounded border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 transition cursor-pointer inline-flex items-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
