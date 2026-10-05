'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  Send,
  Download,
  AlertCircle,
  CreditCard,
  Receipt,
  Link2,
} from 'lucide-react';
import { api, LinkItem, exportToCsv } from '../../api';
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

  const [externalRef, setExternalRef] = useState('');
  const [outcomeType, setOutcomeType] = useState('fee_paid');
  const [value, setValue] = useState<number | ''>('');

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
        matchedLink: d.short_code ? `${d.short_code}${d.tag ? ` (${d.tag})` : ''}` : '—',
        timestamp: new Date(d.occurred_at).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
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

  const handleRecordOutcome = async (e: React.FormEvent) => {
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
          (l) =>
            l.id === res.data?.matchedLinkId ||
            (l.external_ref && l.external_ref.toLowerCase() === externalRef.trim().toLowerCase())
        );
        const matchedCode = matchedLink?.short_code || res.data?.matchedShortCode || 'Unmatched';
        const attributedAmount = formatMoney(Number(value));

        setNotification({
          type: 'success',
          message: `Recorded ${attributedAmount} (${matchedCode})`,
        });

        const newId = res.data?.outcomeId;
        if (newId) {
          setHighlightedOutcomeId(newId);
          setTimeout(() => setHighlightedOutcomeId(null), 5000);
        }

        setExternalRef('');
        setValue('');
        await Promise.all([loadReport(), loadOutcomes()]);
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || 'Failed to record outcome.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Network error.',
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
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-slate-900">Outcomes</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadReport();
              loadOutcomes();
            }}
            aria-label="Refresh outcomes"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportLedger}
            disabled={ledgerEvents.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer"
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
        <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Revenue</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900">
            {totalRev > 0 ? formatMoney(totalRev) : '—'}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Conversions</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900">
            {totalOutcomes > 0 ? formatNumber(totalOutcomes) : '—'}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Conversion Rate</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900">
            {totalOutcomes > 0 ? `${convRate}%` : '—'}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Avg Value</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900">
            {totalOutcomes > 0 ? formatMoney(totalRev / totalOutcomes) : '—'}
          </div>
        </div>
      </div>

      {/* Compact Inline Form (Visible only to authorized roles) */}
      {Permissions.canRecordOutcomes(currentUser?.role) && (
        <form
          onSubmit={handleRecordOutcome}
          className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reference #
            </label>
            <input
              type="text"
              required
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="INV-2026-001"
              className="w-full h-9 text-xs px-3 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
            />
          </div>

          <div className="w-44">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type
            </label>
            <select
              value={outcomeType}
              onChange={(e) => setOutcomeType(e.target.value)}
              className="w-full h-9 text-xs px-2.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="fee_paid">Fee Paid</option>
              <option value="admission_fee">Admission Fee</option>
              <option value="exam_fee">Exam Registration</option>
              <option value="bus_fee">Transport Fee</option>
            </select>
          </div>

          <div className="w-36">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              required
              min={1}
              value={value}
              onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}
              placeholder="15000"
              className="w-full h-9 text-xs px-3 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !externalRef.trim() || !value}
            className="h-9 flex items-center justify-center gap-1.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Record
          </button>
        </form>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">Reference</th>
                <th className="px-3.5 py-2.5">Type</th>
                <th className="px-3.5 py-2.5">Amount</th>
                <th className="px-3.5 py-2.5">Link</th>
                <th className="px-3.5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {pagination.isLazyLoading ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6">
                    <TableSkeleton rows={pagination.pageSize} columns={5} />
                  </td>
                </tr>
              ) : ledgerEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                    No outcomes recorded yet.
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((evt) => {
                  const isHighlighted = highlightedOutcomeId === evt.id;
                  return (
                    <tr
                      key={evt.id}
                      className={`transition-colors ${
                        isHighlighted ? 'bg-emerald-50 font-medium' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                        {evt.externalRef}
                      </td>
                      <td className="px-3.5 py-2.5 capitalize text-slate-700">
                        {evt.outcomeType.replace('_', ' ')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                        {formatMoney(evt.value)}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600 flex items-center gap-1.5">
                        <Link2 className="w-3 h-3 text-slate-400" />
                        {evt.matchedLink}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px]">
                        {evt.timestamp}
                      </td>
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
