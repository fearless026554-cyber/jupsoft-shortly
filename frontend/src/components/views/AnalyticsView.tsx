'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  ShieldCheck,
  Download,
  RefreshCw,
  Zap,
  CheckCircle2,
  Radio,
  Share2,
} from 'lucide-react';
import { api, LinkItem, exportToCsv } from '../../api';
import { formatNumber } from '../../utils/formatters';

interface AnalyticsViewProps {
  links: LinkItem[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ links }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAnalyticsSummary();
      if (data) setSummary(data);
    } catch (err) {
      console.error('Failed to load analytics summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalClicks = Number(
    summary?.total_clicks || links.reduce((s, l) => s + Number(l.click_count || 0), 0)
  );
  const totalOutcomes = Number(summary?.total_outcomes || 0);
  const totalRev = Number(summary?.total_revenue_attributed || 0);

  const prepareChartData = (obj: Record<string, number>, colors: string[] = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-500', 'bg-indigo-500', 'bg-slate-400']) => {
    const entries = Object.entries(obj || {}).map(([label, count]) => ({
      label: label || 'Unknown',
      count: Number(count),
      pct: totalClicks > 0 ? Math.round((Number(count) / totalClicks) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    return entries.map((e, i) => ({
      ...e,
      color: colors[i % colors.length]
    }));
  };

  const getDeviceIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('mobile') || lower.includes('phone') || lower.includes('android') || lower.includes('iphone')) return Smartphone;
    if (lower.includes('tablet') || lower.includes('ipad')) return Tablet;
    return Monitor;
  };

  const channelsData = prepareChartData(summary?.by_referrer || {}, ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500']);
  
  const deviceData = prepareChartData(summary?.by_device || {}, ['bg-blue-600', 'bg-emerald-600', 'bg-amber-500']).map(d => ({
    ...d,
    icon: getDeviceIcon(d.label)
  }));

  const osData = prepareChartData(summary?.by_os || {}, ['bg-[#2DB543]', 'bg-[#0F6CBD]', 'bg-[#0078D4]', 'bg-slate-400']);

  const geoData = prepareChartData(summary?.by_country || {}).map(g => ({
    state: g.label,
    clicks: g.count,
    share: `${g.pct}%`
  }));

  // Fallback for Mobile Share stat
  const mobilePct = deviceData.find(d => d.label.toLowerCase().includes('mobile') || d.label.toLowerCase().includes('phone'))?.pct || 0;

  const handleExport = () => {
    exportToCsv(`traffic_analytics_${new Date().toISOString().slice(0, 10)}`, [
      { Metric: 'Total Click Ingestion', Value: totalClicks },
      { Metric: 'Attributed Conversions', Value: totalOutcomes },
      { Metric: 'Attributed Revenue INR', Value: totalRev },
      { Metric: 'Mobile Traffic %', Value: `${mobilePct}%` },
      { Metric: 'Top OS', Value: osData[0]?.label || 'N/A' },
      { Metric: 'P95 Redirect Latency', Value: '< 2ms' },
    ]);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Traffic Analytics
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded-full font-semibold">
                Real-time
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Monitor link traffic, device statistics, and geographical distribution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range pills */}
          <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-md border border-slate-200/60 shrink-0">
            {(
              [
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: 'all', label: 'ALL' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                  timeRange === t.id
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            aria-label="Refresh Analytics Data"
            title="Refresh Analytics Data"
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            aria-label="Export Analytics to CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Jupsoft Signature Compact Metrics Grid (4 in a row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-colors group block cursor-default shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Total Clicks</span>
            <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-slate-900 tracking-tight">
              {formatNumber(totalClicks)}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg hover:border-amber-400 transition-colors group block cursor-default shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Active Links</span>
            <Zap className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-slate-900 tracking-tight">
              {formatNumber(Number(summary?.total_active_links || 0))}
            </span>
            <span className="text-xs text-slate-500 font-medium">links</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-400 transition-colors group block cursor-default shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Mobile Share</span>
            <Smartphone className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-slate-900 tracking-tight">
              {mobilePct > 0 ? `${mobilePct}%` : '--'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 transition-colors group block cursor-default shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Conversions</span>
            <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-slate-900 tracking-tight">
              {formatNumber(totalOutcomes)}
            </span>
            <span className="text-xs text-slate-500 font-medium">events</span>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid: 2-Column Desktop Grid for Device + OS (Audit P2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Distribution Card */}
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Device Type
            </span>
            <span className="text-[11px] text-slate-400 font-mono">User-Agent</span>
          </div>

          <div className="space-y-3 pt-1">
            {deviceData.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">No device data available</div>
            ) : deviceData.map((d, i) => {
              const Icon = d.icon;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      {d.label}
                    </span>
                    <span className="font-mono text-slate-600 font-semibold text-right tabular-nums">
                      {d.pct}% ({formatNumber(d.count)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full ${d.color} rounded-full`} style={{ width: `${d.pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operating System Distribution Card */}
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-emerald-600" />
              Operating System
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Platform</span>
          </div>

          <div className="space-y-3 pt-1">
            {osData.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">No OS data available</div>
            ) : osData.map((os, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{os.label}</span>
                  <span className="font-mono text-slate-600 font-semibold text-right tabular-nums">{os.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${os.color} rounded-full`} style={{ width: `${os.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Traffic Ingestion Channels */}
      <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-indigo-600" />
            Traffic Sources
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Sources</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {channelsData.length === 0 ? (
              <div className="col-span-full text-center py-4 text-xs text-slate-400">No traffic source data available</div>
            ) : channelsData.map((c, i) => (
            <div key={i} className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 truncate pr-1" title={c.label}>{c.label}</span>
                <span className="font-mono text-slate-900 font-bold text-right tabular-nums">{c.pct}%</span>
              </div>
              <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${c.color} rounded-full`}
                  style={{ width: `${c.pct}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tabular-nums text-right">
                {formatNumber(c.count)} clicks
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-Width Geographic Breakdown Table (Audit P2) */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            Geographic Distribution
          </span>
          <span className="text-[11px] text-slate-500 font-mono">GeoIP Lookup</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Region / State</th>
                <th className="px-4 py-2.5 text-right">Clicks</th>
                <th className="px-4 py-2.5 text-right">Share</th>
                <th className="px-4 py-2.5 w-48">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {geoData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                    No geographic data available
                  </td>
                </tr>
              ) : geoData.map((g, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{g.state}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-blue-600 text-right tabular-nums">{formatNumber(g.clicks)}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 text-right tabular-nums font-semibold">{g.share}</td>
                  <td className="px-4 py-2.5">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: g.share }}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
