'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Ban,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
  Zap,
} from 'lucide-react';
import { AbuseReportItem, api, exportToCsv } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Permissions } from '../../utils/rbac';

interface AbuseViewProps {
  onRefreshBadge?: () => void;
  currentUser?: any;
}

export const AbuseView: React.FC<AbuseViewProps> = ({ onRefreshBadge, currentUser }) => {
  const [reports, setReports] = useState<AbuseReportItem[]>([]);
  const pagination = usePagination(reports, 10);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
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

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await api.getAbuseReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load abuse reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleTakedown = async (repId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Deactivate Link',
      message: 'Deactivate this short link immediately? The link will be suspended across all routing gateways and redirected to a security notice.',
      onConfirm: async () => {
        try {
          const res = await api.updateAbuseReport(repId, { status: 'resolved', disableLink: true });
          if (res.success) {
            setReports((prev) =>
              prev.map((r) => (r.id === repId ? { ...r, status: 'resolved' } : r))
            );
            setActionMessage('URL successfully terminated and blocked across all routing gateways.');
            setTimeout(() => setActionMessage(null), 4000);
            if (onRefreshBadge) onRefreshBadge();
          } else {
            setActionMessage(`Takedown failed: ${res.error?.message || 'Failed to moderate report'}`);
            setTimeout(() => setActionMessage(null), 4000);
          }
        } catch (err: any) {
          setActionMessage(`Network error during takedown: ${err.message || 'Server unreachable'}`);
          setTimeout(() => setActionMessage(null), 4000);
        } finally {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDismiss = async (repId: string) => {
    try {
      const res = await api.updateAbuseReport(repId, { status: 'dismissed' });
      if (res.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === repId ? { ...r, status: 'dismissed' } : r))
        );
        setActionMessage('Report marked as false positive.');
        setTimeout(() => setActionMessage(null), 3000);
        if (onRefreshBadge) onRefreshBadge();
      } else {
        setActionMessage(`Dismiss failed: ${res.error?.message || 'Failed to dismiss report'}`);
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      setActionMessage(`Network error: ${err.message || 'Server unreachable'}`);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Abuse & Security Quarantine
            </h1>
            <p className="text-xs text-slate-500">
              Review flagged destination URLs and manage safety deactivations.
            </p>
          </div>
        </div>

        <button
          onClick={loadReports}
          aria-label="Refresh Threat Quarantine Queue"
          title="Refresh Threat Quarantine Queue"
          className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Moderation Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Flagged Links</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {reports.filter((r) => r.status === 'pending').length}
            </span>
            <span className="text-xs text-slate-400">pending review</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Deactivated Links</span>
            <Ban className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {reports.filter((r) => r.status === 'reviewed').length}
            </span>
            <span className="text-xs text-slate-400">terminated</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Dismissed Reports</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {reports.filter((r) => r.status === 'dismissed').length}
            </span>
            <span className="text-xs text-slate-400">false positives</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Reports</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {reports.length}
            </span>
            <span className="text-xs text-slate-400">all time</span>
          </div>
        </div>
      </div>

      {/* Flagged Queue Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            Active Reports
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {reports.length} Reports
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">Flagged Entity</th>
                <th className="px-3.5 py-2.5">Detection Source</th>
                <th className="px-3.5 py-2.5">Threat Category</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <ShieldCheck className="w-9 h-9 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-slate-700 text-sm">No Security Threats Detected</p>
                    <p className="text-xs text-slate-500 mt-1">All link destinations are currently scanned and clean.</p>
                  </td>
                </tr>
              ) : pagination.isLazyLoading ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6">
                    <TableSkeleton rows={pagination.pageSize} columns={5} />
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                    {rep.link_id}
                  </td>

                  <td className="px-3.5 py-3 text-slate-600 font-mono text-[11px]">
                    {rep.reporter_email || 'Automated Threat Crawler'}
                  </td>

                  <td className="px-3.5 py-3 text-red-700 font-medium max-w-sm">
                    {rep.reason}
                  </td>

                  <td className="px-3.5 py-3">
                    {rep.status === 'pending' ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" /> Under Review
                      </span>
                    ) : (rep.status === 'resolved' || rep.status === 'reviewed') ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-100 font-semibold text-[10px] flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3 text-red-400" /> Takedown Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Dismissed
                      </span>
                    )}
                  </td>

                  <td className="px-3.5 py-3 text-right space-x-1.5">
                    {rep.status === 'pending' ? (
                      Permissions.canManageAbuse(currentUser?.role) ? (
                        <>
                          <button
                            onClick={() => handleDismiss(rep.id)}
                            aria-label={`Mark report ${rep.id} as false positive`}
                            title="Mark report as false positive"
                            className="min-h-[40px] px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                          >
                            False Positive
                          </button>
                          <button
                            onClick={() => handleTakedown(rep.id)}
                            aria-label={`Deactivate and terminate link ${rep.link_id || rep.id}`}
                            title="Deactivate and terminate link"
                            className="min-h-[40px] px-3.5 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
                          >
                            Deactivate Link
                          </button>
                        </>
                      ) : (
                        <span className="text-amber-600 text-xs font-medium">Pending Admin Review</span>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs italic">Action completed</span>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>

          {reports.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={reports.length}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="reports"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Deactivate Link"
        isDestructive={true}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
