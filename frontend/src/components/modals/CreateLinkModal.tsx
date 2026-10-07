'use client';

import React, { useState } from 'react';
import {
  X,
  Link2,
  Tag,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Sparkles,
  Calendar,
  Lock,
  Download,
  Clock,
  Timer,
} from 'lucide-react';
import { api, CreateLinkDto, API_BASE_URL } from '../../api';
import { useTenantDomains, buildShortUrl } from '../../hooks/useTenantDomains';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: () => void;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
  isOpen,
  onClose,
  onLinkCreated,
}) => {
  const [destinationUrl, setDestinationUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [tag, setTag] = useState('General');
  const [externalRef, setExternalRef] = useState('');
  const [maxClicks, setMaxClicks] = useState<number | undefined>(undefined);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [expirationMode, setExpirationMode] = useState<'never' | '1h' | '24h' | '7d' | '30d' | '90d' | 'custom'>('never');
  const { defaultDomain } = useTenantDomains();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const formatRelativeTime = (targetIso: string) => {
    const diffMs = new Date(targetIso).getTime() - Date.now();
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

  const toDatetimeLocalValue = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSelectPreset = (mode: 'never' | '1h' | '24h' | '7d' | '30d' | '90d' | 'custom') => {
    setExpirationMode(mode);
    const now = new Date();
    if (mode === 'never') {
      setExpiresAt('');
    } else if (mode === '1h') {
      const target = new Date(now.getTime() + 60 * 60 * 1000);
      setExpiresAt(target.toISOString());
    } else if (mode === '24h') {
      const target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setExpiresAt(target.toISOString());
    } else if (mode === '7d') {
      const target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setExpiresAt(target.toISOString());
    } else if (mode === '30d') {
      const target = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      setExpiresAt(target.toISOString());
    } else if (mode === '90d') {
      const target = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      setExpiresAt(target.toISOString());
    } else if (mode === 'custom') {
      if (!expiresAt) {
        const defaultCustom = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        setExpiresAt(defaultCustom.toISOString());
      }
    }
  };

  const handleDatetimeLocalChange = (val: string) => {
    if (!val) {
      setExpiresAt('');
      setExpirationMode('never');
    } else {
      setExpiresAt(new Date(val).toISOString());
      setExpirationMode('custom');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let cleanUrl = destinationUrl.trim();
    if (!cleanUrl) {
      setError('Please provide a valid destination URL');
      setLoading(false);
      return;
    }

    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
      setDestinationUrl(cleanUrl);
    }

    try {
      const dto: CreateLinkDto = {
        destinationUrl: cleanUrl,
        alias: alias.trim() ? alias.trim().toLowerCase() : undefined,
        tag: tag || undefined,
        externalRef: externalRef.trim() || undefined,
        maxClicks: maxClicks ? Number(maxClicks) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      };

      const res = await api.createLink(dto);
      if (res.success && res.data) {
        setCreatedData(res.data);
        onLinkCreated();
      } else {
        setError(res.error?.message || 'Failed to create link');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setDestinationUrl('');
    setAlias('');
    setExternalRef('');
    setMaxClicks(undefined);
    setExpiresAt('');
    setExpirationMode('never');
    setCreatedData(null);
    setError(null);
    onClose();
  };

  const handleCopy = () => {
    if (!createdData) return;
    const url = createdData.shortUrl || buildShortUrl(defaultDomain, createdData.shortCode);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-14 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                {createdData ? 'Link Created!' : 'Create Short Link'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {createdData ? 'Your short link is ready.' : 'Create a new short link with custom timer & limits.'}
              </p>
            </div>
          </div>

          <button
            onClick={resetAndClose}
            aria-label="Close dialog"
            title="Close dialog"
            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 text-xs overflow-y-auto flex-1">
          {createdData ? (
            /* Success State */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-3">
                <div className="text-slate-500 font-semibold text-[10px] uppercase">
                  Short URL
                </div>
                <div className="flex items-center gap-2 bg-white p-2.5 rounded border border-emerald-300 font-mono text-sm font-bold text-blue-600">
                  <span className="truncate flex-1">
                    {createdData.shortUrl || buildShortUrl(defaultDomain, createdData.shortCode)}
                  </span>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy short link"
                    title="Copy short link"
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-emerald-800">
                  <span>Short Code: <strong>{createdData.shortCode}</strong></span>
                  {createdData.expiresAt && (
                    <span className="font-mono text-[10px]">Expires: {new Date(createdData.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Dynamic QR Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_BASE_URL}/links/${createdData.id}/qr?format=png&size=140`}
                  alt="QR Code"
                  className="w-20 h-20 bg-white p-1 rounded border border-slate-200 shrink-0"
                />
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">Dynamic QR</div>
                  <p className="text-[11px] text-slate-500">
                    QR code updates automatically if the destination changes.
                  </p>
                  <a
                    href={`${API_BASE_URL}/links/${createdData.id}/qr?format=png&size=1024`}
                    download={`qr_${createdData.shortCode}.png`}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline mt-1"
                  >
                    <Download className="w-3 h-3" /> Download PNG
                  </a>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={resetAndClose}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Destination URL *
                </label>
                <input
                  type="text"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  onBlur={() => {
                    const clean = destinationUrl.trim();
                    if (clean && !/^https?:\/\//i.test(clean)) {
                      setDestinationUrl('https://' + clean);
                    }
                  }}
                  placeholder="https://example.com, www.example.com or example.com"
                  className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alias (Optional)
                  </label>
                  <div className="flex items-center">
                    <span className="bg-slate-100 border border-r-0 border-slate-300 px-2 py-2 rounded-l text-slate-500 font-mono text-[11px]">
                      {defaultDomain}/
                    </span>
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => {
                        setAlias(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="launch-2026"
                      className={`w-full text-xs px-2.5 py-2 rounded-r border font-mono focus:outline-none focus:ring-1 ${
                        error && (error.toLowerCase().includes('alias') || error.toLowerCase().includes('duplicate'))
                          ? 'border-red-500 focus:ring-red-500 bg-red-50/30'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  {error && (error.toLowerCase().includes('alias') || error.toLowerCase().includes('duplicate')) && (
                    <p className="text-[10px] text-red-600 font-medium mt-1">
                      ⚠️ Duplicate: This alias is already in use.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Category Tag
                  </label>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="General">General</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Payment">Payment</option>
                    <option value="Notification">Notification</option>
                    <option value="Support">Support</option>
                  </select>
                </div>
              </div>

              {/* Link Expiration & Timer (Auto-Expire) */}
              <div className="p-3.5 bg-slate-50/90 rounded-lg border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Timer & Expiration (Auto-Expire)</span>
                  </div>
                  {expiresAt && (
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('never')}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-medium underline cursor-pointer"
                    >
                      Clear Timer (Never)
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Choose duration timer or custom date/month. After expiration, clicks redirect to the Expired notification page.
                </p>

                {/* Preset Buttons Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[
                    { id: 'never', label: 'Never' },
                    { id: '1h', label: '1 Hour' },
                    { id: '24h', label: '24 Hours' },
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '1 Month' },
                    { id: '90d', label: '3 Months' },
                    { id: 'custom', label: 'Custom' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id as any)}
                      className={`px-1.5 py-1.5 rounded text-[11px] font-semibold border transition text-center cursor-pointer ${
                        expirationMode === preset.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date & Month Picker */}
                {expirationMode === 'custom' && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Select Custom Date & Time:
                      </label>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocalValue(expiresAt)}
                        min={new Date().toISOString().slice(0, 16)}
                        onChange={(e) => handleDatetimeLocalChange(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono bg-white"
                      />
                    </div>

                    {/* Quick Month & Time Shortcuts */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium">Quick Shortcuts:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(23, 59, 59, 999);
                          setExpiresAt(d.toISOString());
                        }}
                        className="text-[10px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-2 py-0.5 rounded cursor-pointer transition"
                      >
                        Tonight (23:59)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 1, 0);
                          d.setHours(23, 59, 59, 999);
                          setExpiresAt(d.toISOString());
                        }}
                        className="text-[10px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-2 py-0.5 rounded cursor-pointer transition"
                      >
                        End of This Month
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 2, 0);
                          d.setHours(23, 59, 59, 999);
                          setExpiresAt(d.toISOString());
                        }}
                        className="text-[10px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-2 py-0.5 rounded cursor-pointer transition"
                      >
                        End of Next Month
                      </button>
                    </div>
                  </div>
                )}

                {/* Expiry Feedback / Countdown Badge */}
                {expiresAt ? (
                  <div className="flex items-center justify-between p-2 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>
                        Expires: <strong>{new Date(expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                      </span>
                    </div>
                    <span className="font-mono font-semibold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700 shadow-2xs">
                      {formatRelativeTime(expiresAt)}
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Permanent link (Never expires).
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    External Ref (Optional)
                  </label>
                  <input
                    type="text"
                    value={externalRef}
                    onChange={(e) => setExternalRef(e.target.value)}
                    placeholder="e.g. INV-2026-9021"
                    className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Optional reference ID.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Clicks (Optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxClicks || ''}
                    onChange={(e) => setMaxClicks(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 100"
                    className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-3.5 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
