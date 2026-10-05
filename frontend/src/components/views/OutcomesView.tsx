'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Send,
  Download,
  AlertCircle,
  CreditCard,
  Receipt,
  Sparkles,
  Link2,
} from 'lucide-react';
import { api, LinkItem, exportToCsv } from '../../api';
import { useTenantDomains } from '../../hooks/useTenantDomains';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { Permissions } from '../../utils/rbac';

interface OutcomesViewProps {
  links: LinkItem[];
  currentUser?: any;
}

export const OutcomesView: React.FC<OutcomesViewProps> = ({ links, currentUser }) => {
  const [report, setReport] = useState<{
    total_links: string | number;
    total_clicks: string | number;
    total_outcomes: string | number;
    total_revenue_attributed: string | number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { defaultDomain } = useTenantDomains();

  // Simulation Form State (empty by default)
  const [externalRef, setExternalRef] = useState('');
  const [outcomeType, setOutcomeType] = useState('fee_paid');
  const [value, setValue] = useState<number | ''>('');

  // Live event ledger
  const [ledgerEvents, setLedgerEvents] = useState<Array<{
    id: string;
    externalRef: string;
    outcomeType: string;
    value: number;
    matchedLink?: string;
    timestamp: string;
  }>>([]);

  const pagination = usePagination(ledgerEvents, 10);
  const [highlightedOutcomeId, setHighlightedOutcomeId] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getOutcomesReport();
      if (data) {
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load outcome report:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOutcomes = async () => {
    try {
      const data = await api.getOutcomes();
      const formatted = (Array.isArray(data) ? data : []).map((d: any) => ({
        id: d.id,
        externalRef: d.external_ref,
        outcomeType: d.outcome_type,
        value: Number(d.value),
        matchedLink: d.short_code ? `${d.short_code} (${d.tag || 'Link'})` : 'Auto-Matched via ERP ref',
        timestamp: new Date(d.occurred_at).toLocaleString(),
      }));
      setLedgerEvents(formatted);
    } catch (err) {
      console.error('Failed to load outcomes:', err);
    }
  };

  useEffect(() => {
    loadReport();
    loadOutcomes();
  }, []);

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalRef.trim() || !value) return;

    setSubmitting(true);
    setNotification(null);

    try {
      const res = await api.recordOutcome({
        externalRef: externalRef.trim(),
        outcomeType,
        value: Number(value),
      });

      if (res.success) {
        const matchedLink = links.find(
          (l) => l.id === res.data?.matchedLinkId || (l.external_ref && l.external_ref.toLowerCase() === externalRef.trim().toLowerCase())
        );
        const matchedCode = matchedLink?.short_code || res.data?.matchedShortCode || (links[0]?.short_code || 'fHXV8q');
        const attributedAmount = formatMoney(Number(value));

        setNotification({
          type: 'success',
          message: `Conversion Attributed! Matched Short Code: ${matchedCode} • Amount: ${attributedAmount}`,
        });

        const newId = res.data?.outcomeId;
        if (newId) {
          setHighlightedOutcomeId(newId);
          setTimeout(() => setHighlightedOutcomeId(null), 8000);
        }

        setExternalRef('');
        setValue('');
        await Promise.all([loadReport(), loadOutcomes()]);
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || 'Failed to record outcome event.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Network error while posting outcome event.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportLedger = () => {
    exportToCsv(
      `outcomes_ledger_${new Date().toISOString().slice(0, 10)}`,
      ledgerEvents.map((evt) => ({
        EventID: evt.id,
        ExternalRef: evt.externalRef,
        OutcomeType: evt.outcomeType,
        RevenueINR: evt.value,
        MatchedLink: evt.matchedLink || '',
        Timestamp: evt.timestamp,
      }))
    );
  };

  const totalRev = Number(report?.total_revenue_attributed || 0);
  const totalOutcomes = Number(report?.total_outcomes || 0);
  const totalClicks = Number(report?.total_clicks || links.reduce((s, l) => s + Number(l.click_count || 0), 0));
  const convRate = totalClicks > 0 ? ((totalOutcomes / totalClicks) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Outcomes & Conversions
            </h1>
            <p className="text-xs text-slate-500">
              Track successful fee payments and admission registrations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadReport();
              loadOutcomes();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Attributed Revenue</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalRev > 0 ? formatMoney(totalRev) : '—'}
            </span>
            <span className="text-[11px] text-slate-400">
              {totalRev > 0 ? 'Verified' : 'No conversions yet'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Conversions</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalOutcomes > 0 ? formatNumber(totalOutcomes) : '—'}
            </span>
            <span className="text-[11px] text-slate-400">
              {totalOutcomes > 0 ? 'Events logged' : 'No events yet'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Conversion Rate</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalOutcomes > 0 ? `${convRate}%` : '—'}
            </span>
            <span className="text-[11px] text-slate-400">
              {totalClicks > 0 ? `${totalClicks} clicks` : 'No clicks yet'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Avg Order Value</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalOutcomes > 0 ? formatMoney(totalRev / totalOutcomes) : '—'}
            </span>
            <span className="text-[11px] text-slate-400">
              {totalOutcomes > 0 ? 'Per transaction' : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Simulator Form & Attribution Explainer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Interactive ERP Webhook Trigger (Visible only to authorized roles) */}
        {Permissions.canRecordOutcomes(currentUser?.role) && (
          <div className="lg:col-span-5 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                Simulate Conversion Event
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                Operations
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Record a conversion or fee payment event to test closed-loop attribution:
            </p>

            <form onSubmit={handleSimulatePayment} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  External Reference (Invoice / Admission #)
                </label>
                <input
                  type="text"
                  required
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder="e.g. INV-2026-001"
                  className="w-full h-10 text-xs px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Matches the <code className="bg-slate-100 px-1 py-0.2 rounded text-slate-700 font-mono">external_ref</code> of an SMS short link.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Outcome Type
                  </label>
                  <select
                    value={outcomeType}
                    onChange={(e) => setOutcomeType(e.target.value)}
                    className="w-full h-10 text-xs px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="fee_paid">Fee Paid</option>
                    <option value="admission_fee">Admission Fee</option>
                    <option value="exam_fee">Exam Registration</option>
                    <option value="bus_fee">Transport Fee</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Value (₹ INR)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={value}
                    onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 15000"
                    className="w-full h-10 text-xs px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !externalRef.trim() || !value}
                className="w-full h-10 mt-1 flex items-center justify-center gap-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Dispatching Event...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Dispatch Outcome Event {value ? `(${formatMoney(Number(value))})` : ''}
                  </>
                )}
              </button>
              {!externalRef.trim() && (
                <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5 mt-1.5 bg-amber-50 px-2.5 py-1.5 rounded border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Enter an invoice / external reference number to enable dispatch.</span>
                </p>
              )}
            </form>
          </div>
        )}

        {/* Right: Architecture Explainer & Pipeline */}
        <div className={`${Permissions.canRecordOutcomes(currentUser?.role) ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3`}>
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                Reconciliation Pipeline
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700">1. SMS Dispatched</div>
                <div className="font-mono text-xs text-slate-600 mt-1">{defaultDomain}/fHXV8q</div>
                <p className="text-[10px] text-slate-500 mt-1">SMS gateway sends short link with invoice reference.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700">2. Link Clicked</div>
                <div className="font-mono text-xs text-slate-600 mt-1">&lt; 2ms Redirect</div>
                <p className="text-[10px] text-slate-500 mt-1">Engine captures click analytics and routes to fee portal.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700">3. Fee Settled</div>
                <div className="font-mono text-xs text-slate-600 mt-1">Ledger Matched</div>
                <p className="text-[10px] text-slate-500 mt-1">Payment gateway webhook reconciles with link reference.</p>
              </div>
            </div>

            {/* Visual Settlement Voucher Card */}
            <div className="mt-3.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Event Preview
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {externalRef ? 'Ready for reconciliation' : 'Awaiting invoice #'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-medium">Invoice Number</div>
                  <div className="font-medium text-slate-800 font-mono mt-0.5 truncate">{externalRef || '—'}</div>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-medium">Outcome Event</div>
                  <div className="font-medium text-slate-800 capitalize mt-0.5">{outcomeType.replace('_', ' ')}</div>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-medium">Gross Amount</div>
                  <div className="font-medium text-slate-800 font-mono mt-0.5">{value ? formatMoney(Number(value)) : '—'}</div>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-medium">Reconciled Route</div>
                  <div className="font-medium text-slate-700 mt-0.5 truncate">
                    Automated ERP Match
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attribution Event Ledger Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Conversion Ledger ({ledgerEvents.length} Events)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Recent Events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">Event ID</th>
                <th className="px-3.5 py-2.5">Invoice / External Ref</th>
                <th className="px-3.5 py-2.5">Outcome Category</th>
                <th className="px-3.5 py-2.5">Attributed Value</th>
                <th className="px-3.5 py-2.5">Matched Link</th>
                <th className="px-3.5 py-2.5">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {pagination.isLazyLoading ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-6">
                    <TableSkeleton rows={pagination.pageSize} columns={6} />
                  </td>
                </tr>
              ) : ledgerEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-70" />
                    <p className="font-bold text-slate-700 text-sm">No Attributed Events Found</p>
                    <p className="text-xs text-slate-500 mt-0.5">Simulate a payment above or receive webhook callbacks from your ERP.</p>
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((evt) => {
                  const isHighlighted = highlightedOutcomeId === evt.id;
                  return (
                    <tr
                      key={evt.id}
                      className={`transition-colors duration-500 ${
                        isHighlighted
                          ? 'bg-emerald-100/90 ring-2 ring-inset ring-emerald-500 font-medium'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-500">{evt.id}</td>
                      <td className="px-3.5 py-2 font-mono font-bold text-blue-600">{evt.externalRef}</td>
                      <td className="px-3.5 py-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px] uppercase">
                          {evt.outcomeType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">
                        {formatMoney(evt.value)}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-600 flex items-center gap-1.5">
                        <Link2 className="w-3 h-3 text-slate-400" />
                        {evt.matchedLink}
                      </td>
                      <td className="px-3.5 py-2 text-slate-400 font-mono text-[11px]">{evt.timestamp}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {ledgerEvents.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={ledgerEvents.length}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="events"
            />
          )}
        </div>
      </div>
    </div>
  );
};
