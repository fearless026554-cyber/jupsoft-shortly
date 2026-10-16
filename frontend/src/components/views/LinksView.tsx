'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  QrCode,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Tag,
  ChevronDown,
  ArrowUpDown,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
  Link2,
  RotateCcw,
  Archive,
  Globe,
  TrendingUp,
  Edit2,
  Shield,
} from 'lucide-react';
import { LinkItem, exportToCsv } from '../../api';
import { useTenantDomains, buildShortUrl } from '../../hooks/useTenantDomains';
import { usePagination } from '../../hooks/usePagination';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TableSkeleton } from '../ui/Skeleton';
import { Pagination } from '../ui/Pagination';
import { Permissions, isPermanentLink } from '../../utils/rbac';
import { PermanentLinkDeleteModal } from '../modals/PermanentLinkDeleteModal';

interface LinksViewProps {
  links: LinkItem[];
  loading?: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenCreateModal: () => void;
  onSelectDrawerLink: (link: LinkItem) => void;
  onSelectQrLink: (link: LinkItem) => void;
  onArchiveLink: (id: string) => void;
  onRestoreLink?: (id: string) => void;
  onDeletePermanently?: (id: string) => void;
  onBatchArchive?: (ids: string[]) => Promise<void>;
  onBatchRestore?: (ids: string[]) => Promise<void>;
  onBatchDelete?: (ids: string[]) => Promise<void>;
  activeDrawerLinkId?: string;
  currentUser?: any;
}

function getDomainFromUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const clean = urlStr.trim();
  if (!clean) return '';
  try {
    const withProto = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    const match = clean.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s:?#]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

export const LinksView: React.FC<LinksViewProps> = ({
  links,
  loading = false,
  searchQuery,
  setSearchQuery,
  onOpenCreateModal,
  onSelectDrawerLink,
  onSelectQrLink,
  onArchiveLink,
  onRestoreLink,
  onDeletePermanently,
  onBatchArchive,
  onBatchRestore,
  onBatchDelete,
  activeDrawerLinkId,
  currentUser,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'expired' | 'archived' | 'permanent'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7d' | '30d' | 'has_timer' | 'expiring_soon'>('all');
  const [websiteFilter, setWebsiteFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'most_clicks' | 'least_clicks' | 'expiring_soon'>('newest');
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<LinkItem | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);
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
  
  const { defaultDomain } = useTenantDomains();
  const archivedCount = links.filter((l) => l.status === 'archived').length;
  const permanentCount = links.filter((l) => isPermanentLink(l) && l.status !== 'archived').length;

  const isLinkExpired = (link: LinkItem) => {
    if (link.status === 'expired') return true;
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return true;
    return false;
  };

  // Context-aware link pool: calculates stats based on current status filter tab
  const poolForFilterStats = React.useMemo(() => {
    return links.filter((l) => {
      const expired = isLinkExpired(l);
      if (statusFilter === 'all') return l.status !== 'archived';
      if (statusFilter === 'active') return l.status === 'active' && !expired;
      if (statusFilter === 'expired') return expired && l.status !== 'archived';
      if (statusFilter === 'disabled') return l.status === 'disabled';
      if (statusFilter === 'archived') return l.status === 'archived';
      if (statusFilter === 'permanent') return isPermanentLink(l) && l.status !== 'archived';
      return true;
    });
  }, [links, statusFilter]);

  const websiteStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of poolForFilterStats) {
      const domain = getDomainFromUrl(l.destination_url);
      if (domain) {
        counts[domain] = (counts[domain] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [poolForFilterStats]);

  const tagStats = React.useMemo(() => {
    const counts: Record<string, { display: string; count: number }> = {};
    for (const l of poolForFilterStats) {
      const raw = l.tag?.trim();
      if (raw) {
        const key = raw.toLowerCase();
        if (!counts[key]) {
          counts[key] = { display: raw, count: 0 };
        }
        counts[key].count += 1;
      }
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .map((item) => [item.display, item.count] as [string, number]);
  }, [poolForFilterStats]);

  // Auto-reconcile destination filter if switched to a tab where that domain doesn't exist
  useEffect(() => {
    if (websiteFilter !== 'all') {
      const exists = websiteStats.some(([d]) => d.toLowerCase() === websiteFilter.toLowerCase());
      if (!exists) {
        setWebsiteFilter('all');
      }
    }
  }, [websiteStats, websiteFilter]);

  // Auto-reconcile tag filter if switched to a tab where that tag doesn't exist
  useEffect(() => {
    if (tagFilter !== 'all') {
      const exists = tagStats.some(([t]) => t.toLowerCase() === tagFilter.toLowerCase());
      if (!exists) {
        setTagFilter('all');
      }
    }
  }, [tagStats, tagFilter]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    timeFilter !== 'all' ||
    websiteFilter !== 'all' ||
    tagFilter !== 'all' ||
    sortOrder !== 'newest' ||
    searchQuery.trim() !== '';

  // Clear selected links when search query or filter changes to avoid acting on hidden items
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, timeFilter, websiteFilter, tagFilter, sortOrder, searchQuery]);


  const formatTimeRemaining = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const diffMins = Math.round(diffMs / (60 * 1000));
    if (diffMins < 60) return `in ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffHours < 24) return `in ${diffHours}h ${remMins > 0 ? `${remMins}m` : ''}`.trim();
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    if (diffDays < 30) return `in ${diffDays}d ${remHours > 0 ? `${remHours}h` : ''}`.trim();
    const diffMonths = Math.floor(diffDays / 30);
    return `in ${diffMonths}mo ${diffDays % 30 > 0 ? `${diffDays % 30}d` : ''}`.trim();
  };

  const handleCopy = (shortCode: string, id: string) => {
    navigator.clipboard.writeText(buildShortUrl(defaultDomain, shortCode)).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLinks.length && filteredLinks.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLinks.map((l) => l.id));
    }
  };

  const filteredLinks = links
    .filter((l) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (l.short_code && l.short_code.toLowerCase().includes(q)) ||
        (l.destination_url && l.destination_url.toLowerCase().includes(q)) ||
        (l.alias && l.alias.toLowerCase().includes(q)) ||
        (l.tag && l.tag.toLowerCase().includes(q)) ||
        (l.external_ref && l.external_ref.toLowerCase().includes(q));

      const expired = isLinkExpired(l);
      let matchesStatus = true;
      if (statusFilter === 'all') {
        matchesStatus = l.status !== 'archived';
      } else if (statusFilter === 'active') {
        matchesStatus = l.status === 'active' && !expired;
      } else if (statusFilter === 'expired') {
        matchesStatus = expired && l.status !== 'archived';
      } else if (statusFilter === 'disabled') {
        matchesStatus = l.status === 'disabled';
      } else if (statusFilter === 'archived') {
        matchesStatus = l.status === 'archived';
      } else if (statusFilter === 'permanent') {
        matchesStatus = isPermanentLink(l) && l.status !== 'archived';
      }

      let matchesTime = true;
      const now = Date.now();
      const createdAt = new Date(l.created_at).getTime();
      if (timeFilter === 'today') {
        const todayMidnight = new Date().setHours(0, 0, 0, 0);
        matchesTime = createdAt >= todayMidnight;
      } else if (timeFilter === '7d') {
        matchesTime = createdAt >= now - 7 * 24 * 3600 * 1000;
      } else if (timeFilter === '30d') {
        matchesTime = createdAt >= now - 30 * 24 * 3600 * 1000;
      } else if (timeFilter === 'has_timer') {
        matchesTime = Boolean(l.expires_at);
      } else if (timeFilter === 'expiring_soon') {
        if (!l.expires_at) {
          matchesTime = false;
        } else {
          const exp = new Date(l.expires_at).getTime();
          matchesTime = exp > now && exp <= now + 48 * 3600 * 1000;
        }
      }

      let matchesWebsite = true;
      if (websiteFilter !== 'all') {
        const d = getDomainFromUrl(l.destination_url);
        const target = websiteFilter.trim().toLowerCase();
        matchesWebsite = d === target || d.endsWith(`.${target}`) || (l.destination_url || '').toLowerCase().includes(target);
      }

      let matchesTag = true;
      if (tagFilter !== 'all') {
        matchesTag = (l.tag || '').trim().toLowerCase() === tagFilter.trim().toLowerCase();
      }

      return matchesSearch && matchesStatus && matchesTime && matchesWebsite && matchesTag;
    })
    .sort((a, b) => {
      if (sortOrder === 'most_clicks') {
        return Number(b.click_count || 0) - Number(a.click_count || 0);
      }
      if (sortOrder === 'least_clicks') {
        return Number(a.click_count || 0) - Number(b.click_count || 0);
      }
      if (sortOrder === 'expiring_soon') {
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      }
      if (sortOrder === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const pagination = usePagination(filteredLinks, 10);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handlePageChangeWithScroll = (page: number) => {
    pagination.setCurrentPage(page);
    if (tableContainerRef.current) {
      const top = tableContainerRef.current.getBoundingClientRect().top + window.scrollY - 80;
      if (window.scrollY > top) {
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  };

  const handleExport = () => {
    exportToCsv(
      `links_export_${new Date().toISOString().slice(0, 10)}`,
      filteredLinks.map((l) => ({
        ShortCode: l.short_code,
        Alias: l.alias || '',
        ShortUrl: buildShortUrl(defaultDomain, l.short_code),
        TargetUrl: l.destination_url,
        Clicks: l.click_count,
        Status: isLinkExpired(l) ? 'expired' : l.status,
        ExpiresAt: l.expires_at || 'Permanent',
        MaxClicks: l.max_clicks || 'Unlimited',
        Tag: l.tag || '',
        ExternalRef: l.external_ref || '',
        CreatedAt: l.created_at,
      }))
    );
  };

  return (
    <div className="space-y-3.5 w-full">
      {/* Top Compact Action & Context Strip (Height ~36px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
        {/* Left: View Dropdown, Segmented Status Filter & Date/Timer Selector */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              {statusFilter === 'archived' ? 'Archived Links' : statusFilter === 'permanent' ? 'Permanent Links' : 'Short Links'}
            </h1>
            <span className="text-[11px] font-mono text-slate-400">({filteredLinks.length})</span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                statusFilter === 'expired'
                  ? 'bg-white text-amber-700 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Expired
            </button>
            <button
              onClick={() => setStatusFilter('permanent')}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1.5 ${
                statusFilter === 'permanent'
                  ? 'bg-white text-amber-700 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Shield className="w-3 h-3 text-amber-600" />
              <span>Permanent</span>
              {permanentCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800 font-mono font-bold">
                  {permanentCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1.5 ${
                statusFilter === 'archived'
                  ? 'bg-white text-rose-700 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>Archive</span>
              {archivedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-700 font-mono font-bold">
                  {archivedCount}
                </span>
              )}
            </button>
          </div>

          {/* Date / Timer Filter */}
          <div
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 border transition-colors ${
              timeFilter !== 'all'
                ? 'bg-blue-50/90 border-blue-300 text-blue-700 shadow-2xs font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Clock className={`w-3 h-3 ${timeFilter !== 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="text-[10px] font-semibold bg-transparent focus:outline-none cursor-pointer"
              title="Filter by Creation Date or Timer status"
            >
              <option value="all">All Dates</option>
              <option value="today">Created Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days (Month)</option>
              <option value="has_timer">Has Timer / Expiry</option>
              <option value="expiring_soon">Expiring Soon (48h)</option>
            </select>
          </div>

          {/* Target Destination Filter */}
          <div
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 border transition-colors ${
              websiteFilter !== 'all'
                ? 'bg-blue-50/90 border-blue-300 text-blue-700 shadow-2xs font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Globe className={`w-3 h-3 ${websiteFilter !== 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
            <select
              value={websiteFilter}
              onChange={(e) => setWebsiteFilter(e.target.value)}
              className="text-[10px] font-semibold bg-transparent focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              title="Filter by Target Destination"
            >
              <option value="all">All Destinations ({websiteStats.length})</option>
              {websiteStats.map(([domain, count]) => (
                <option key={domain} value={domain}>
                  {domain} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Tag / Category Filter */}
          <div
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 border transition-colors ${
              tagFilter !== 'all'
                ? 'bg-blue-50/90 border-blue-300 text-blue-700 shadow-2xs font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Tag className={`w-3 h-3 ${tagFilter !== 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="text-[10px] font-semibold bg-transparent focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate"
              title="Filter by Campaign Tag / Category"
            >
              <option value="all">All Tags ({tagStats.length})</option>
              {tagStats.map(([tag, count]) => (
                <option key={tag} value={tag}>
                  {tag} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Sort Order */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="text-[10px] font-semibold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
              title="Sort Links"
            >
              <option value="newest">Newest First</option>
              <option value="most_clicks">Most Clicks</option>
              <option value="least_clicks">Least Clicks</option>
              <option value="expiring_soon">Expiring Soonest</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Clear Filters Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTimeFilter('all');
                setWebsiteFilter('all');
                setTagFilter('all');
                setSortOrder('newest');
                setSearchQuery('');
              }}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Mass Actions or Primary Actions */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 animate-in fade-in flex-wrap">
              <span className="font-semibold text-xs">{selectedIds.length} selected</span>
              {statusFilter === 'archived' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
                        setAlertConfig({
                          isOpen: true,
                          title: 'Permission Denied',
                          message: 'Only Super Admin and Tenant Admin can restore permanent links.',
                        });
                        return;
                      }

                      const permanentIds = selectedIds.filter((id) => {
                        const l = links.find((x) => x.id === id);
                        return l && isPermanentLink(l);
                      });

                      if (permanentIds.length === 0) {
                        setAlertConfig({
                          isOpen: true,
                          title: 'Cannot Restore Selected',
                          message: 'None of the selected links are Permanent. Standard links cannot be restored once archived.',
                        });
                        return;
                      }

                      if (onBatchRestore) {
                        await onBatchRestore(permanentIds);
                      } else if (onRestoreLink) {
                        await Promise.all(permanentIds.map((id) => onRestoreLink(id)));
                      }
                      setSelectedIds([]);

                      if (permanentIds.length < selectedIds.length) {
                        setAlertConfig({
                          isOpen: true,
                          title: 'Partial Restore Completed',
                          message: `Restored ${permanentIds.length} permanent link(s). The other ${selectedIds.length - permanentIds.length} non-permanent link(s) cannot be restored.`,
                        });
                      }
                    }}
                    className="text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore Permanent Selected
                  </button>

                  <button
                    onClick={() => {
                      const hasPermanent = selectedIds.some((id) => {
                        const l = links.find((x) => x.id === id);
                        return l && isPermanentLink(l);
                      });

                      if (hasPermanent && !Permissions.canManagePermanentLinks(currentUser?.role)) {
                        setAlertConfig({
                          isOpen: true,
                          title: 'Permission Denied',
                          message: 'Selected items contain Permanent Protected Assets. Only Super Admin and Tenant Admin can delete permanent links.',
                        });
                        return;
                      }

                      setConfirmConfig({
                        isOpen: true,
                        title: 'Permanently Delete Selected Links',
                        message: hasPermanent
                          ? `CRITICAL: You are about to permanently delete ${selectedIds.length} link(s), which include Permanent Protected Assets. This action cannot be undone.`
                          : `Are you sure you want to permanently delete all ${selectedIds.length} selected links? This action cannot be undone.`,
                        onConfirm: async () => {
                          if (onBatchDelete) {
                            await onBatchDelete(selectedIds);
                          } else if (onDeletePermanently) {
                            await Promise.all(selectedIds.map((id) => onDeletePermanently(id)));
                          }
                          setSelectedIds([]);
                          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
                        },
                      });
                    }}
                    className="text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-300 px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Permanently
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const hasPermanent = selectedIds.some((id) => {
                      const l = links.find((x) => x.id === id);
                      return l && isPermanentLink(l);
                    });

                    if (hasPermanent && !Permissions.canManagePermanentLinks(currentUser?.role)) {
                      setAlertConfig({
                        isOpen: true,
                        title: 'Permission Denied',
                        message: 'Selected links include Permanent Protected Assets. Only Super Admin and Tenant Admin can archive permanent links.',
                      });
                      return;
                    }

                    setConfirmConfig({
                      isOpen: true,
                      title: 'Archive Selected Links',
                      message: hasPermanent
                        ? `Warning: Selected items include Permanent Protected links. Archiving will halt incoming live traffic. Are you sure you want to archive all ${selectedIds.length} selected links?`
                        : `Archive all ${selectedIds.length} selected links? Standard links cannot be restored once archived.`,
                      onConfirm: async () => {
                        if (onBatchArchive) {
                          await onBatchArchive(selectedIds);
                        } else {
                          await Promise.all(selectedIds.map((id) => onArchiveLink(id)));
                        }
                        setSelectedIds([]);
                        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
                      },
                    });
                  }}
                  className="text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-300 px-2.5 py-1 rounded text-[11px] font-bold ml-1 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Archive Selected
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by short code, tag, or invoice #..."
                className="w-56 text-xs pl-7 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
          )}

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Export
          </button>

          {Permissions.canCreateLinks(currentUser?.role) && (
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F6CBD] hover:bg-[#0c599b] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Link
            </button>
          )}
        </div>
      </div>

      {/* Jupsoft High-Density Data Grid */}
      <div ref={tableContainerRef} className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={7} />
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 uppercase text-[9px] tracking-wider">
                <tr>
                  <th className="py-2 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredLinks.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-[#0F6CBD] cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3">Short URL</th>
                  <th className="py-2 px-3">Destination</th>
                  <th className="py-2 px-3">Category & Ref</th>
                  <th className="py-2 px-3 text-center">Clicks</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {pagination.isLazyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6">
                      <TableSkeleton rows={pagination.pageSize} columns={7} />
                    </td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((link) => (
                  <tr
                    key={link.id}
                    onClick={() => onSelectDrawerLink(link)}
                    className={`hover:bg-blue-50/40 cursor-pointer transition group ${
                      activeDrawerLinkId === link.id ? 'bg-blue-50/70' : ''
                    }`}
                  >
                    {/* Select Checkbox */}
                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(link.id)}
                        onChange={() => toggleSelect(link.id)}
                        className="rounded border-slate-300 text-[#0F6CBD] cursor-pointer"
                      />
                    </td>

                    {/* Branded Short URL */}
                    <td className="py-2 px-3 font-mono">
                      <div className="font-bold text-[#0F6CBD] flex items-center gap-1.5 text-[11px]">
                        <span>{defaultDomain}/{link.short_code}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(link.short_code, link.id);
                          }}
                          aria-label="Copy short link"
                          title="Copy short link"
                          className="text-slate-300 hover:text-slate-700 p-0.5 transition cursor-pointer"
                        >
                          {copiedId === link.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {link.alias && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            Alias: <span className="font-mono text-slate-700 font-bold">{link.alias}</span>
                          </div>
                        )}
                        {isPermanentLink(link) && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded uppercase tracking-wider"
                            title="Permanent Protected Link: Multi-step verification required for deletion; restorable from archive."
                          >
                            <Shield className="w-2.5 h-2.5 text-amber-600" />
                            Permanent
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Destination Target (Favicon + Domain Truncated with hover copy) */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2 max-w-[280px]">
                        {getDomainFromUrl(link.destination_url) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(link.destination_url)}`}
                            alt=""
                            className="w-3.5 h-3.5 rounded-xs shrink-0 object-contain bg-slate-100"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            const dom = getDomainFromUrl(link.destination_url);
                            if (dom) setWebsiteFilter(dom);
                          }}
                          className="truncate text-slate-600 font-mono text-[10px] block flex-1 hover:text-blue-600 cursor-pointer transition-colors"
                          title={`Click to filter by destination: ${link.destination_url}`}
                        >
                          {link.destination_url}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(link.destination_url).catch(() => {});
                          }}
                          aria-label="Copy Destination URL"
                          title="Copy Destination URL"
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Tag & Invoice Reference */}
                    <td className="py-2 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        {link.tag && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter(link.tag || 'all');
                            }}
                            title={`Filter by tag: ${link.tag}`}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            <Tag className="w-2.5 h-2.5 text-blue-500" />
                            <span className="truncate max-w-[120px]">{link.tag}</span>
                          </button>
                        )}
                        {link.external_ref && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                            <span className="text-slate-400 font-bold">#</span>
                            <span className="truncate max-w-[120px]">{link.external_ref}</span>
                          </span>
                        )}
                        {!link.tag && !link.external_ref && (
                          <span className="text-[10px] text-slate-300 font-sans italic">—</span>
                        )}
                      </div>
                    </td>

                    {/* Click Count Badge */}
                    <td className="py-2 px-3 text-center">
                      <div className="inline-flex items-center justify-center font-mono font-bold text-[11px]">
                        {Number(link.click_count || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                            <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{Number(link.click_count).toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal px-2 py-0.5">0</span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge with Live Timer / Countdown */}
                    <td className="py-2 px-3 text-center">
                      {isLinkExpired(link) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Expired
                          </span>
                          {link.expires_at && (
                            <span
                              className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-mono border border-amber-200"
                              title={`Expired on ${new Date(link.expires_at).toLocaleString()}`}
                            >
                              {new Date(link.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      ) : link.status === 'active' ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                          </span>
                          {link.expires_at ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-mono font-medium border border-blue-200"
                              title={`Expires on ${new Date(link.expires_at).toLocaleString()}`}
                            >
                              <Clock className="w-2.5 h-2.5 text-blue-500" />
                              {formatTimeRemaining(link.expires_at)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-sans">
                              Permanent
                            </span>
                          )}
                        </div>
                      ) : link.status === 'archived' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium capitalize">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> {link.status}
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 flex-wrap sm:flex-nowrap">
                        <button
                          onClick={() => handleCopy(link.short_code, link.id)}
                          aria-label={`Copy short link https://${defaultDomain}/${link.short_code}`}
                          title="Copy short link"
                          className="min-w-[40px] min-h-[40px] p-2 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer flex items-center justify-center"
                        >
                          {copiedId === link.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => onSelectQrLink(link)}
                          aria-label={`View QR Code for ${link.short_code}`}
                          title="View QR Code"
                          className="min-w-[40px] min-h-[40px] p-2 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer flex items-center justify-center"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        <a
                          href={buildShortUrl(defaultDomain, link.short_code)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Test Live Redirect for ${buildShortUrl(defaultDomain, link.short_code)}`}
                          title="Test Live Redirect"
                          className="min-w-[40px] min-h-[40px] p-2 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition flex items-center justify-center"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => onSelectDrawerLink(link)}
                          aria-label={`Edit ${link.short_code}`}
                          title="Edit Target Destination & Timer"
                          className="min-w-[40px] min-h-[40px] p-2 hover:bg-slate-100 rounded-md text-slate-500 hover:text-blue-600 transition cursor-pointer flex items-center justify-center"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {Permissions.canEditLinks(currentUser?.role) && (
                          <div className="ml-3 pl-2.5 border-l border-slate-200 flex items-center">
                            {link.status === 'archived' ? (
                              <div className="flex items-center gap-1.5">
                                {isPermanentLink(link) ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
                                        setAlertConfig({
                                          isOpen: true,
                                          title: 'Permission Denied',
                                          message: 'Only Super Admin and Tenant Admin can restore Permanent Protected links.',
                                        });
                                        return;
                                      }
                                      if (onRestoreLink) {
                                        onRestoreLink(link.id);
                                      }
                                    }}
                                    aria-label={`Restore short link https://${defaultDomain}/${link.short_code}`}
                                    title="Restore permanent short link to active"
                                    className="min-w-[36px] min-h-[32px] px-2.5 py-1 border border-emerald-300 hover:border-emerald-500 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">Restore</span>
                                  </button>
                                ) : (
                                  <span
                                    className="text-[10px] text-slate-400 font-medium italic px-2 py-1 select-none"
                                    title="Non-permanent links cannot be restored once archived."
                                  >
                                    Non-restorable
                                  </span>
                                )}

                                {onDeletePermanently && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isPermanentLink(link)) {
                                        if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
                                          setAlertConfig({
                                            isOpen: true,
                                            title: 'Permission Denied',
                                            message: 'Only Super Admin and Tenant Admin can permanently delete Permanent Protected links.',
                                          });
                                          return;
                                        }
                                        setPermanentDeleteTarget(link);
                                        return;
                                      }

                                      setConfirmConfig({
                                        isOpen: true,
                                        title: 'Permanently Delete Link',
                                        message: `Are you sure you want to permanently delete https://${defaultDomain}/${link.short_code}? This action cannot be undone.`,
                                        onConfirm: () => {
                                          onDeletePermanently(link.id);
                                          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
                                        },
                                      });
                                    }}
                                    aria-label={`Permanently delete short link https://${defaultDomain}/${link.short_code}`}
                                    title="Permanently delete from database"
                                    className="min-w-[36px] min-h-[32px] px-2 py-1 border border-red-300 hover:border-red-500 bg-red-50/70 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">Delete</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isPermanentLink(link)) {
                                    if (!Permissions.canManagePermanentLinks(currentUser?.role)) {
                                      setAlertConfig({
                                        isOpen: true,
                                        title: 'Permission Denied',
                                        message: 'This link is a Permanent Protected Asset. Only Super Admin and Tenant Admin can archive or delete permanent links.',
                                      });
                                      return;
                                    }
                                    setPermanentDeleteTarget(link);
                                    return;
                                  }

                                  setConfirmConfig({
                                    isOpen: true,
                                    title: 'Archive Link',
                                    message: `Are you sure you want to archive the link https://${defaultDomain}/${link.short_code}? It will be moved to Archive. Note: standard links cannot be restored once archived.`,
                                    onConfirm: () => {
                                      onArchiveLink(link.id);
                                      setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                aria-label={`Archive short link https://${defaultDomain}/${link.short_code}`}
                                title={isPermanentLink(link) ? 'Archive Permanent Link (Requires verification)' : 'Archive short link'}
                                className="min-w-[40px] min-h-[36px] px-2.5 py-1.5 border border-red-300 hover:border-red-500 bg-red-50/60 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Archive</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
                
                {!pagination.isLazyLoading && filteredLinks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                          <Link2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-slate-700">No links found</h4>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          {searchQuery || statusFilter !== 'all' 
                            ? 'Try adjusting your search or filters.' 
                            : 'No short links found in this workspace.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {filteredLinks.length > 0 && !loading && (
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={filteredLinks.length}
              pageSize={pagination.pageSize}
              onPageChange={handlePageChangeWithScroll}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="links"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Archive"
        isDestructive={true}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {alertConfig?.isOpen && (
        <ConfirmDialog
          isOpen={true}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText="Dismiss"
          isDestructive={false}
          onConfirm={() => setAlertConfig(null)}
          onCancel={() => setAlertConfig(null)}
        />
      )}

      <PermanentLinkDeleteModal
        isOpen={Boolean(permanentDeleteTarget)}
        link={permanentDeleteTarget}
        defaultDomain={defaultDomain}
        onClose={() => setPermanentDeleteTarget(null)}
        onArchive={async (id) => {
          await onArchiveLink(id);
          setPermanentDeleteTarget(null);
        }}
        onDeletePermanently={
          onDeletePermanently
            ? async (id) => {
                await onDeletePermanently(id);
                setPermanentDeleteTarget(null);
              }
            : undefined
        }
      />
    </div>
  );
};
