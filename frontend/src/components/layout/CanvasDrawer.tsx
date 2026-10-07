'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  Download,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Tag,
  Calendar,
  Building2,
  ShieldCheck,
  Clock,
  Timer,
  Edit2,
} from 'lucide-react';
import { api, LinkItem, API_BASE_URL } from '../../api';
import { useTenantDomains, buildShortUrl } from '../../hooks/useTenantDomains';

interface CanvasDrawerProps {
  link: LinkItem | null;
  onClose: () => void;
  onArchive: (id: string) => void;
  onRestore?: (id: string) => void;
  onDeletePermanently?: (id: string) => void;
  onLinkUpdated?: (updated: LinkItem) => void;
}

export const CanvasDrawer: React.FC<CanvasDrawerProps> = ({ link, onClose, onArchive, onRestore, onDeletePermanently, onLinkUpdated }) => {
  const [copied, setCopied] = useState(false);
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [customExpiryInput, setCustomExpiryInput] = useState('');
  const { defaultDomain } = useTenantDomains();

  useEffect(() => {
    setIsEditingExpiry(false);
    setCustomExpiryInput('');
  }, [link?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!link) return null;

  const shortUrl = buildShortUrl(defaultDomain, link.short_code);

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = link.status === 'expired' || (link.expires_at ? new Date(link.expires_at).getTime() < Date.now() : false);

  const formatRemainingTime = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const diffMins = Math.round(diffMs / (60 * 1000));
    if (diffMins < 60) return `in ${diffMins} minutes`;
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffHours < 24) return `in ${diffHours}h ${remMins > 0 ? `${remMins}m` : ''}`.trim();
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    if (diffDays < 30) return `in ${diffDays} days ${remHours > 0 ? `(${remHours}h remaining)` : ''}`.trim();
    const diffMonths = Math.floor(diffDays / 30);
    return `in ${diffMonths} month(s)`;
  };

  const handleApplyPreset = async (hours: number | null) => {
    setSavingExpiry(true);
    try {
      let newExpiresAt: string | null = null;
      if (hours !== null) {
        newExpiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      }
      const res = await api.updateLink(link.id, { expiresAt: newExpiresAt });
      if (res.success && res.data) {
        setIsEditingExpiry(false);
        onLinkUpdated?.(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingExpiry(false);
    }
  };

  const handleApplyCustomExpiry = async () => {
    if (!customExpiryInput) return;
    setSavingExpiry(true);
    try {
      const iso = new Date(customExpiryInput).toISOString();
      const res = await api.updateLink(link.id, { expiresAt: iso });
      if (res.success && res.data) {
        setIsEditingExpiry(false);
        onLinkUpdated?.(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingExpiry(false);
    }
  };

  return (
    <>
      {/* Backdrop overlay (dismisses drawer on outside click) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] z-40 animate-in fade-in duration-150 cursor-pointer"
        aria-label="Close Link Details"
      />

      <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 select-none">
        {/* Drawer Header */}
        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-blue-600" />
          Link Details
        </div>
        <button
          onClick={onClose}
          aria-label="Close Canvas Drawer"
          title="Close Canvas Drawer"
          className="p-1 hover:bg-slate-200 rounded text-slate-500 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
        {/* Dynamic Vector QR Section */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${API_BASE_URL}/links/${link.id}/qr?format=png&size=180`}
            alt="Link QR Code"
            className="w-40 h-40 border border-slate-200 rounded shadow-xs bg-white p-1.5"
          />
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Dynamic QR · Auto-Updates Target
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <a
              href={`${API_BASE_URL}/links/${link.id}/qr?format=png&size=1024`}
              download={`qr_${link.short_code}.png`}
              className="text-[11px] text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs"
            >
              <Download className="w-3 h-3" /> PNG (1024px)
            </a>
            <a
              href={`${API_BASE_URL}/links/${link.id}/qr?format=svg`}
              download={`qr_${link.short_code}.svg`}
              className="text-[11px] text-slate-700 font-semibold hover:underline inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs"
            >
              <Download className="w-3 h-3" /> Vector SVG
            </a>
          </div>
        </div>

        {/* Short URL Section */}
        <div>
          <div className="text-slate-400 font-semibold text-[10px] uppercase">Branded Short URL</div>
          <div className="font-mono text-sm font-bold text-blue-600 flex items-center justify-between mt-1 bg-blue-50/50 p-2 rounded border border-blue-100">
            <span className="truncate">{shortUrl}</span>
            <button
              onClick={handleCopy}
              aria-label="Copy Branded Short URL"
              className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
              title="Copy"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Destination Target */}
        <div>
          <div className="text-slate-400 font-semibold text-[10px] uppercase">Target Destination</div>
          <div className="text-slate-700 break-all bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 font-mono text-[11px]">
            {link.destination_url}
          </div>
        </div>

        {/* Clicks & Status Cards */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] text-slate-400">Total Clicks</div>
            <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">{link.click_count}</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] text-slate-400">Status</div>
            <div className={`text-xs font-bold font-mono capitalize mt-1.5 flex items-center gap-1 ${isExpired ? 'text-amber-700' : 'text-emerald-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              {isExpired ? 'Expired' : link.status}
            </div>
          </div>
        </div>

        {/* Link Expiration & Timer Card */}
        <div className="p-3 bg-slate-50/90 rounded-lg border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Timer & Expiration</span>
            </div>
            <button
              onClick={() => setIsEditingExpiry(!isEditingExpiry)}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              {isEditingExpiry ? 'Cancel' : 'Change Timer'}
            </button>
          </div>

          {!isEditingExpiry ? (
            <div className="space-y-1.5">
              {link.expires_at ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Live Status:</span>
                    <span className={`font-semibold font-mono text-[11px] ${isExpired ? 'text-amber-700' : 'text-blue-700'}`}>
                      {isExpired ? '⚠️ Expired' : `⏱️ Active (${formatRemainingTime(link.expires_at)})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-1">
                    <span>Expiry Timestamp:</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {new Date(link.expires_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Permanent Link
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">No Timer Set</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-1 border-t border-slate-200 animate-in fade-in">
              <div className="text-[11px] text-slate-500">Apply quick timer or pick custom date/month:</div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleApplyPreset(1)}
                  className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded text-[11px] font-semibold text-center cursor-pointer transition disabled:opacity-50"
                >
                  +1 Hour
                </button>
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleApplyPreset(24)}
                  className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded text-[11px] font-semibold text-center cursor-pointer transition disabled:opacity-50"
                >
                  +24 Hours
                </button>
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleApplyPreset(24 * 7)}
                  className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded text-[11px] font-semibold text-center cursor-pointer transition disabled:opacity-50"
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleApplyPreset(24 * 30)}
                  className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded text-[11px] font-semibold text-center cursor-pointer transition disabled:opacity-50"
                >
                  +1 Month
                </button>
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleApplyPreset(24 * 90)}
                  className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded text-[11px] font-semibold text-center cursor-pointer transition disabled:opacity-50"
                >
                  +3 Months
                </button>
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleApplyPreset(null)}
                  className="px-2 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold text-center cursor-pointer transition disabled:opacity-50"
                >
                  Clear (Never)
                </button>
              </div>

              {/* Custom Date Input */}
              <div className="pt-1.5 space-y-1">
                <label className="block text-[10px] font-semibold text-slate-600 uppercase">
                  Or Pick Custom Date & Time:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="datetime-local"
                    value={customExpiryInput}
                    min={(() => {
                      const d = new Date();
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })()}
                    onChange={(e) => setCustomExpiryInput(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    disabled={savingExpiry || !customExpiryInput}
                    onClick={handleApplyCustomExpiry}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingExpiry ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tag & External Reference */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          {link.tag && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Campaign Tag:</span>
              <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                {link.tag}
              </span>
            </div>
          )}
          {link.external_ref && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">External Ref:</span>
              <span className="font-mono font-bold text-slate-800 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                {link.external_ref}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Created At:</span>
            <span className="font-mono text-slate-600 text-[11px]">
              {new Date(link.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <a
            href={shortUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-center block shadow-xs transition"
          >
            Test Link
          </a>
          {link.status === 'archived' ? (
            <div className="space-y-2">
              <button
                onClick={() => onRestore && onRestore(link.id)}
                className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                Restore Short Link
              </button>
              {onDeletePermanently && (
                <button
                  onClick={() => onDeletePermanently(link.id)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Permanently Delete
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onArchive(link.id)}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold text-center transition cursor-pointer"
            >
              Archive Short Link
            </button>
          )}
        </div>
      </div>
    </div>
  </>
);
};
