'use client';

import React, { useState } from 'react';
import {
  Link2,
  BarChart3,
  DollarSign,
  TrendingUp,
  Zap,
  ArrowRight,
  Eye,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { LinkItem, api } from '../../api';
import { useTenantDomains, buildShortUrl } from '../../hooks/useTenantDomains';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { CardSkeleton, TableSkeleton, Skeleton } from '../ui/Skeleton';
import { Permissions } from '../../utils/rbac';

interface DashboardViewProps {
  links: LinkItem[];
  loading?: boolean;
  onNavigateToLinks: () => void;
  onNavigateToOutcomes: () => void;
  onSelectDrawerLink: (link: LinkItem) => void;
  onOpenCreateModal: () => void;
  currentUser?: any;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  links,
  loading = false,
  onNavigateToLinks,
  onNavigateToOutcomes,
  onSelectDrawerLink,
  onOpenCreateModal,
  currentUser,
}) => {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | 'ytd'>('30d');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const { defaultDomain } = useTenantDomains();

  React.useEffect(() => {
    api.getAnalyticsSummary().then((data) => {
      if (data) setSummary(data);
    }).catch(() => {});
  }, []);

  const totalClicks = Number(
    summary?.total_clicks || links.reduce((sum, l) => sum + Number(l.click_count || 0), 0)
  );
  const totalRevenue = Number(summary?.total_revenue_attributed || 0);
  const totalConversions = Number(summary?.total_outcomes || 0);

  const handleCopy = (shortCode: string, id: string) => {
    navigator.clipboard.writeText(buildShortUrl(defaultDomain, shortCode));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-3 font-sans text-slate-800 w-full">
      {/* Top Action & Context Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900">
            Dashboard
          </h1>
        </div>

        {/* Time Segmented Selector */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md shrink-0">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: 'ytd', label: 'YTD' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeRange(t.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                timeRange === t.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            {/* Metric 1 */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Active Links</span>
                <Link2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                  {formatNumber(links.length)}
                </span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Total Clicks</span>
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                  {formatNumber(totalClicks)}
                </span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Conversions</span>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                  {formatNumber(totalConversions)}
                </span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Attributed Revenue</span>
                <DollarSign className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                  {formatMoney(totalRevenue)}
                </span>
              </div>
            </div>

            {/* Metric 5 */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Avg Routing</span>
                <Zap className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                  &lt; 2ms
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two-Column Grid for Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column (2/3): Top Links Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-2.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[#0F6CBD]" />
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                  Top Links
                </h3>
              </div>
              <button
                onClick={onNavigateToLinks}
                className="text-[10px] text-[#0F6CBD] hover:text-blue-800 font-bold uppercase tracking-wide flex items-center gap-1 transition"
              >
                <span>View All ({links.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-4">
                  <TableSkeleton rows={3} columns={4} />
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Short URL / Target</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-right">Clicks</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {links.slice(0, 5).map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/70 transition group">
                        <td className="px-3 py-2">
                          <div className="font-mono font-bold text-[#0F6CBD] flex items-center gap-1.5 text-[11px]">
                            <span>{defaultDomain}/{l.short_code}</span>
                            <button
                              onClick={() => handleCopy(l.short_code, l.id)}
                              aria-label="Copy short link"
                              className="p-0.5 hover:text-slate-900 text-slate-300 transition cursor-pointer"
                            >
                              {copiedId === l.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[200px] mt-0.5" title={l.destination_url}>
                            {l.destination_url}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-slate-600">
                            {l.tag || 'General'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 text-[11px]">
                          {formatNumber(Number(l.click_count || 0))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => onSelectDrawerLink(l)}
                            className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px] uppercase tracking-wider transition inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {links.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                              <Link2 className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-700">No active links found</h4>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                              Start by creating your first short link to see analytics data.
                            </p>
                            {Permissions.canCreateLinks(currentUser?.role) && (
                              <button
                                onClick={onOpenCreateModal}
                                className="mt-2 px-4 py-1.5 rounded-lg bg-[#0F6CBD] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
                              >
                                Create Short Link
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1/3): Live Engagement Feed */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-3 flex flex-col space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Recent Activity
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1">
            {links.length === 0 ? (
              <div className="p-3 text-center text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <p className="font-medium text-slate-500 text-xs">No activity yet</p>
                <p className="text-xs text-slate-400 mt-1">Traffic and link events will appear here.</p>
              </div>
            ) : (
              links.slice(0, 4).map((l) => (
                <div key={l.id} className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1.5 group hover:border-slate-200 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 text-xs truncate mr-2">
                      {l.alias || l.tag || 'Short Link'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {l.created_at
                        ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono flex items-center justify-between">
                    <span className="text-[#0F6CBD] truncate max-w-[130px]">{defaultDomain}/{l.short_code}</span>
                    <span className="text-slate-600 font-sans font-medium text-xs">{formatNumber(Number(l.click_count || 0))} clicks</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
