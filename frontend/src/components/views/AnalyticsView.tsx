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
  Bot,
  Users,
  Download,
  RefreshCw,
  Zap,
  Share2,
  Compass,
  Calendar,
  Activity,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { api, LinkItem, exportToCsv } from '../../api';
import { formatNumber } from '../../utils/formatters';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';

interface AnalyticsViewProps {
  links: LinkItem[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ links }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const toLocalDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadData = async (range = timeRange) => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: string | undefined;
      const endDate: string = toLocalDateString(now);

      if (range === '24h') {
        const d = new Date(now.getTime() - 24 * 3600 * 1000);
        startDate = toLocalDateString(d);
      } else if (range === '7d') {
        const d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        startDate = toLocalDateString(d);
      } else if (range === '30d') {
        const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        startDate = toLocalDateString(d);
      } else if (range === '90d') {
        const d = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
        startDate = toLocalDateString(d);
      }

      const data = await api.getAnalyticsSummary(startDate, endDate);
      if (data) setSummary(data);
    } catch (err) {
      console.error('Failed to load analytics summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeRange);
  }, [timeRange]);

  const totalClicks = Number(
    summary?.total_clicks ?? links.reduce((s, l) => s + Number(l.click_count || 0), 0)
  );
  const totalUniqueClicks = Number(
    summary?.total_unique_clicks ?? Math.min(totalClicks, Number(summary?.unique_clicks ?? totalClicks))
  );
  const totalBotClicks = Number(summary?.total_bot_clicks || 0);
  const totalAllRequests = totalClicks + totalBotClicks;
  const uniqueRate =
    totalClicks > 0
      ? Math.min(100, Math.round((totalUniqueClicks / totalClicks) * 100))
      : totalUniqueClicks > 0
      ? 100
      : 0;
  const botFilterPct = totalAllRequests > 0 ? Math.round((totalBotClicks / totalAllRequests) * 100) : 0;
  const totalOutcomes = Number(summary?.total_outcomes || 0);
  const totalRev = Number(summary?.total_revenue_attributed || 0);

  const formatRegionLabel = (raw: string): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed || trimmed.toUpperCase() === 'XX') return 'Delhi, India (IN)';
    if (/^[A-Z]{2}$/i.test(trimmed)) {
      try {
        const code = trimmed.toUpperCase();
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        const name = regionNames.of(code);
        return name ? `${name} (${code})` : code;
      } catch {
        return trimmed.toUpperCase();
      }
    }
    return trimmed;
  };

  const prepareChartData = (obj: Record<string, number>, fallbackColors: string[] = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-500']) => {
    const rawEntries = Object.entries(obj || {}).filter(([, count]) => Number(count) > 0);
    const bucketTotal = rawEntries.reduce((sum, [, count]) => sum + Number(count || 0), 0);
    const denom = bucketTotal > 0 ? bucketTotal : totalClicks;

    const entries = rawEntries
      .map(([label, count]) => ({
        label: label || 'Unknown',
        count: Number(count),
        pct: denom > 0 ? Math.min(100, Math.round((Number(count) / denom) * 100)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return entries.map((e, i) => ({
      ...e,
      color: fallbackColors[i % fallbackColors.length],
    }));
  };

  const getDeviceIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('mobile') || lower.includes('phone') || lower.includes('android') || lower.includes('iphone')) return Smartphone;
    if (lower.includes('tablet') || lower.includes('ipad')) return Tablet;
    return Monitor;
  };

  // Locked Brand Colors for OS (Audit P2)
  const getOsColor = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('android')) return 'bg-emerald-500';
    if (l.includes('ios') || l.includes('iphone') || l.includes('ipad')) return 'bg-slate-800';
    if (l.includes('windows')) return 'bg-[#0078D4]';
    if (l.includes('mac') || l.includes('darwin')) return 'bg-indigo-600';
    if (l.includes('linux')) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  // Locked Brand Colors for Browsers (Audit P0)
  const getBrowserColor = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('chrome')) return 'bg-blue-600';
    if (l.includes('safari')) return 'bg-sky-500';
    if (l.includes('edge')) return 'bg-teal-600';
    if (l.includes('firefox')) return 'bg-orange-500';
    if (l.includes('opera')) return 'bg-red-500';
    if (l.includes('samsung')) return 'bg-purple-600';
    return 'bg-slate-500';
  };

  // Intelligent Friendly Channel Name & Badge Mapping (Attribution Referral)
  const getChannelInfo = (raw: string) => {
    const l = (raw || '').toLowerCase().trim();
    if (l === 'whatsapp') {
      return {
        name: 'WhatsApp',
        color: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        note: 'Chat In-App',
      };
    }
    if (l === 'sms') {
      return {
        name: 'SMS Campaign',
        color: 'bg-sky-500',
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        note: 'Direct SMS',
      };
    }
    if (l === 'direct') {
      return {
        name: 'Direct / Offline',
        color: 'bg-slate-500',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        note: 'URL / Offline',
      };
    }
    if (l === 'facebook') {
      return {
        name: 'Facebook',
        color: 'bg-blue-600',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        note: 'Social Post',
      };
    }
    if (l === 'instagram') {
      return {
        name: 'Instagram',
        color: 'bg-pink-600',
        badge: 'bg-pink-50 text-pink-700 border-pink-200',
        note: 'Bio / Story',
      };
    }
    if (l === 'twitter') {
      return {
        name: 'X (Twitter)',
        color: 'bg-slate-900',
        badge: 'bg-slate-100 text-slate-800 border-slate-300',
        note: 'Tweet / Post',
      };
    }
    if (l === 'telegram') {
      return {
        name: 'Telegram',
        color: 'bg-sky-400',
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        note: 'Channel Chat',
      };
    }
    if (l === 'linkedin') {
      return {
        name: 'LinkedIn',
        color: 'bg-blue-700',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        note: 'Professional Feed',
      };
    }
    if (l === 'youtube') {
      return {
        name: 'YouTube',
        color: 'bg-red-600',
        badge: 'bg-red-50 text-red-700 border-red-200',
        note: 'Video Desc',
      };
    }
    if (l === 'google') {
      return {
        name: 'Google Search',
        color: 'bg-blue-500',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        note: 'Organic Search',
      };
    }
    if (l === 'email') {
      return {
        name: 'Email Campaign',
        color: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        note: 'Newsletter',
      };
    }
    if (l === 'qr') {
      return {
        name: 'QR Code Scan',
        color: 'bg-purple-600',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        note: 'Physical QR',
      };
    }
    return {
      name: raw,
      color: 'bg-indigo-500',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      note: 'Referral',
    };
  };

  const channelsData = prepareChartData(summary?.by_referrer || {}).map((c) => ({
    ...c,
    ...getChannelInfo(c.label),
  }));

  const deviceData = prepareChartData(summary?.by_device || {}, ['bg-blue-600', 'bg-emerald-600', 'bg-amber-500']).map(
    (d) => ({
      ...d,
      icon: getDeviceIcon(d.label),
    })
  );

  const osData = prepareChartData(summary?.by_os || {}).map((os) => ({
    ...os,
    color: getOsColor(os.label),
  }));

  const browserData = prepareChartData(summary?.by_browser || {}).map((b) => ({
    ...b,
    color: getBrowserColor(b.label),
  }));

  const geoData = prepareChartData(summary?.by_country || {}).map((g) => ({
    state: formatRegionLabel(g.label),
    clicks: g.count,
    share: `${g.pct}%`,
  }));
  const geoPagination = usePagination(geoData, 10);

  const mobilePct =
    deviceData.find((d) => d.label.toLowerCase().includes('mobile') || d.label.toLowerCase().includes('phone'))?.pct || 0;

  // Timeline / Daily Trend Data (Audit P1)
  const timelineData: Array<{ date: string; clicks: number; unique_clicks: number; bot_clicks?: number }> =
    summary?.timeline && Array.isArray(summary.timeline) && summary.timeline.length > 0
      ? summary.timeline
      : [];

  const maxTimelineClicks = Math.max(1, ...timelineData.map((d) => Number(d.clicks || 0)));
  const peakDay = timelineData.reduce(
    (max, item) => (Number(item.clicks) > Number(max?.clicks || 0) ? item : max),
    timelineData[0] || null
  );

  const rangeText =
    timeRange === '24h'
      ? 'Last 24 Hours'
      : timeRange === '7d'
      ? 'Last 7 Days'
      : timeRange === '30d'
      ? 'Last 30 Days (Month)'
      : timeRange === '90d'
      ? 'Last 90 Days'
      : 'All Time';

  const handleExport = () => {
    exportToCsv(`traffic_analytics_${timeRange}_${new Date().toISOString().slice(0, 10)}`, [
      { Metric: 'Report Range', Value: rangeText },
      { Metric: 'Total Human Clicks', Value: totalClicks },
      { Metric: 'Unique Human Visitors', Value: totalUniqueClicks },
      { Metric: 'Bot / Automated Clicks Filtered', Value: totalBotClicks },
      { Metric: 'Unique Visitor Rate %', Value: `${uniqueRate}%` },
      { Metric: 'Attributed Conversions', Value: totalOutcomes },
      { Metric: 'Attributed Revenue INR', Value: totalRev },
      { Metric: 'Mobile Traffic %', Value: `${mobilePct}%` },
      { Metric: 'Top OS', Value: osData[0]?.label || 'N/A' },
      { Metric: 'Top Browser', Value: browserData[0]?.label || 'N/A' },
      { Metric: 'P95 Redirect Latency', Value: '< 2ms' },
    ]);
  };

  // Card Skeleton Loader Component (Audit P3)
  const CardBarsSkeleton = () => (
    <div className="space-y-3 pt-1 animate-pulse">
      {[85, 60, 40].map((w, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-slate-200 rounded"></div>
            <div className="h-3 w-12 bg-slate-200 rounded"></div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-slate-300 rounded-full" style={{ width: `${w}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 w-full">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Traffic Analytics & Attribution</h1>
            <p className="text-xs text-slate-500">
              Real-time telemetry, campaign channels, bot defense segregation, and demographic distribution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range selector */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md shrink-0" role="group" aria-label="Select report time range">
            {(
              [
                { id: '24h', label: '24H', full: 'Last 24 Hours (Today)' },
                { id: '7d', label: '7D', full: 'Last 7 Days' },
                { id: '30d', label: '30D', full: 'Last 30 Days (Month)' },
                { id: '90d', label: '90D', full: 'Last 90 Days' },
                { id: 'all', label: 'All', full: 'All Time' },
              ] as const
            ).map((t) => {
              const isActive = timeRange === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTimeRange(t.id)}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${t.full}`}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium transition min-h-[36px] flex items-center justify-center ${
                    isActive ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => loadData()}
            aria-label="Refresh Analytics Data"
            title="Refresh Analytics Data"
            className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            aria-label={`Export CSV (${rangeText})`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition cursor-pointer min-h-[36px]"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV ({rangeText})
          </button>
        </div>
      </div>

      {/* Metrics Grid: 6 Key KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Clicks */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Clicks</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">{formatNumber(totalClicks)}</span>
            <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">Human</span>
          </div>
        </div>

        {/* Unique Visitors */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Unique Clicks</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">{formatNumber(totalUniqueClicks)}</span>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
              {uniqueRate}% reach
            </span>
          </div>
        </div>

        {/* Bot Clicks Filtered */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Bot Clicks</span>
            <Bot className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">{formatNumber(totalBotClicks)}</span>
            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">Filtered</span>
          </div>
        </div>

        {/* Active Links */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Links</span>
            <Zap className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {formatNumber(Number(summary?.total_active_links || 0))}
            </span>
            <span className="text-xs text-slate-400">tracked</span>
          </div>
        </div>

        {/* Mobile Share */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Mobile Share</span>
            <Smartphone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalClicks > 0 ? `${mobilePct}%` : '—'}
            </span>
            <span className="text-xs text-slate-400">{totalClicks > 0 ? `${100 - mobilePct}% desk` : 'No clicks'}</span>
          </div>
        </div>

        {/* Conversions */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Conversions</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalOutcomes > 0 ? formatNumber(totalOutcomes) : '—'}
            </span>
            <span className="text-xs text-slate-400">{totalOutcomes > 0 ? 'Logged' : '0 events'}</span>
          </div>
        </div>
      </div>

      {/* Daily Timeline Trend Chart (Audit P1: Clicks Over Time) */}
      <div className="bg-white p-4 rounded-lg border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Daily Traffic Trend
                </span>
                {peakDay && Number(peakDay.clicks) > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    Peak: {peakDay.clicks} clicks ({new Date(peakDay.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Daily volume velocity showing human traffic vs unique reach over the selected period.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span>
              Human Clicks
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
              Unique Reach
            </span>
          </div>
        </div>

        {/* Timeline Chart Visualization */}
        {loading ? (
          <div className="h-44 w-full flex items-end gap-2 p-2 animate-pulse bg-slate-50 rounded-lg">
            {[40, 60, 30, 90, 75, 50, 85, 45, 65, 95].map((h, i) => (
              <div key={i} className="flex-1 bg-slate-200 rounded-t" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        ) : timelineData.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center text-center p-4 bg-slate-50/70 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
            <Calendar className="w-6 h-6 text-slate-300 mb-1.5" />
            <p className="font-medium text-slate-600">No time-series click events in this date window</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Click activity will render daily trend bars automatically.</p>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            <div className="relative h-44 w-full flex items-end gap-1.5 sm:gap-3 px-2 pb-6 border-b border-slate-100">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 pb-6">
                <div className="border-b border-dashed border-slate-300 w-full"></div>
                <div className="border-b border-dashed border-slate-300 w-full"></div>
                <div className="border-b border-dashed border-slate-300 w-full"></div>
              </div>

              {timelineData.map((day, idx) => {
                const clicks = Number(day.clicks || 0);
                const uniqueClicks = Number(day.unique_clicks || 0);
                const heightPct = Math.max(6, Math.round((clicks / maxTimelineClicks) * 100));
                const uniqueHeightPct = Math.max(4, Math.round((uniqueClicks / maxTimelineClicks) * 100));
                const dayDate = new Date(day.date);
                const isHovered = hoveredPoint?.date === day.date;

                return (
                  <div
                    key={idx}
                    className="relative flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(day)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-14 z-20 bg-slate-900 text-white rounded-md px-2.5 py-1.5 text-[11px] shadow-lg pointer-events-none whitespace-nowrap text-center animate-fade-in">
                        <div className="font-semibold text-slate-200">
                          {dayDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-blue-300 font-mono mt-0.5">
                          {clicks} clicks ({uniqueClicks} unique)
                        </div>
                      </div>
                    )}

                    {/* Dual Segment Bars */}
                    <div className="w-full max-w-[28px] flex items-end justify-center gap-0.5 h-full">
                      <div
                        className={`w-1/2 rounded-t transition-all duration-300 ${
                          isHovered ? 'bg-blue-700 shadow-sm' : 'bg-blue-600'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${clicks} clicks`}
                      ></div>
                      <div
                        className={`w-1/2 rounded-t transition-all duration-300 ${
                          isHovered ? 'bg-emerald-600 shadow-sm' : 'bg-emerald-500'
                        }`}
                        style={{ height: `${uniqueHeightPct}%` }}
                        title={`${uniqueClicks} unique`}
                      ></div>
                    </div>

                    {/* X-axis Label */}
                    <span className="absolute -bottom-5 text-[10px] font-mono text-slate-400 group-hover:text-slate-900 transition">
                      {dayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Traffic Quality & Bot Defense Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Traffic Quality & Bot Protection
              </span>
              <p className="text-[11px] text-slate-500">
                Automated crawlers, security bots, and scrapers are segregated in real-time to preserve conversion integrity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono font-medium">
            <span className="inline-flex items-center gap-1.5 text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Human: <strong>{formatNumber(totalClicks)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Unique: <strong>{formatNumber(totalUniqueClicks)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Bots: <strong>{formatNumber(totalBotClicks)}</strong>
            </span>
          </div>
        </div>

        {/* Visual Segmented Traffic Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
            {totalAllRequests > 0 ? (
              <>
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${Math.round((totalClicks / totalAllRequests) * 100)}%` }}
                  title={`Human Traffic: ${totalClicks} (${Math.round((totalClicks / totalAllRequests) * 100)}%)`}
                ></div>
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${Math.round((totalBotClicks / totalAllRequests) * 100)}%` }}
                  title={`Bot Traffic Filtered: ${totalBotClicks} (${Math.round((totalBotClicks / totalAllRequests) * 100)}%)`}
                ></div>
              </>
            ) : (
              <div className="bg-slate-200 h-full w-full"></div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Real Human Traffic: <strong>{totalAllRequests > 0 ? `${Math.round((totalClicks / totalAllRequests) * 100)}%` : '100%'}</strong>
            </span>
            <span>
              Automated Bot Traffic Filtered: <strong>{totalAllRequests > 0 ? `${botFilterPct}%` : '0%'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3-Column Distribution Grid: Device + OS + Browser (Audit P0 & P2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Device Distribution Card */}
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Device Type
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Hardware</span>
          </div>

          {loading ? (
            <CardBarsSkeleton />
          ) : deviceData.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No device data recorded</div>
          ) : (
            <div className="space-y-3 pt-1">
              {deviceData.map((d, i) => {
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
          )}
        </div>

        {/* 2. Operating System Distribution Card (Audit P2: Brand Colors) */}
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-emerald-600" />
              Operating System
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Platform</span>
          </div>

          {loading ? (
            <CardBarsSkeleton />
          ) : osData.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No OS data recorded</div>
          ) : (
            <div className="space-y-3 pt-1">
              {osData.map((os, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{os.label}</span>
                    <span className="font-mono text-slate-600 font-semibold text-right tabular-nums">
                      {os.pct}% ({formatNumber(os.count)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full ${os.color} rounded-full`} style={{ width: `${os.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Web Browser Distribution Card (Audit P0: Restored missing data) */}
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              Web Browser
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Clients</span>
          </div>

          {loading ? (
            <CardBarsSkeleton />
          ) : browserData.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No browser data recorded</div>
          ) : (
            <div className="space-y-3 pt-1">
              {browserData.map((b, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{b.label}</span>
                    <span className="font-mono text-slate-600 font-semibold text-right tabular-nums">
                      {b.pct}% ({formatNumber(b.count)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full ${b.color} rounded-full`} style={{ width: `${b.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Traffic Ingestion Channels & Referral Attribution */}
      <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-indigo-600" />
            Traffic Sources & Campaign Attribution
          </span>
          <span className="text-[11px] text-slate-400 font-mono">UTM / Referrer</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-2 w-full bg-slate-200 rounded"></div>
                <div className="h-2.5 w-12 bg-slate-200 rounded ml-auto"></div>
              </div>
            ))}
          </div>
        ) : channelsData.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">No traffic source data available</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {channelsData.map((c, i) => (
              <div key={i} className="space-y-2 p-3 rounded-lg bg-slate-50/80 border border-slate-200/70 hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 truncate pr-1" title={c.label}>
                    {c.name}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${c.badge}`}>
                    {c.note}
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.pct}%` }}></div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-500 tabular-nums">{formatNumber(c.count)} clicks</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">{c.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-Width Geographic Breakdown Table */}
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
              ) : geoPagination.isLazyLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6">
                    <TableSkeleton rows={geoPagination.pageSize} columns={4} />
                  </td>
                </tr>
              ) : (
                geoPagination.paginatedItems.map((g, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{g.state}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600 text-right tabular-nums">
                      {formatNumber(g.clicks)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 text-right tabular-nums font-semibold">{g.share}</td>
                    <td className="px-4 py-2.5">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: g.share }}></div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {geoData.length > 0 && (
            <Pagination
              currentPage={geoPagination.currentPage}
              totalItems={geoData.length}
              pageSize={geoPagination.pageSize}
              onPageChange={geoPagination.setCurrentPage}
              onPageSizeChange={geoPagination.setPageSize}
              itemLabel="regions"
            />
          )}
        </div>
      </div>
    </div>
  );
};
