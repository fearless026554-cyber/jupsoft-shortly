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
} from 'lucide-react';
import { api, CreateLinkDto, API_BASE_URL } from '../../api';
import { useTenantDomains } from '../../hooks/useTenantDomains';

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
  const [tag, setTag] = useState('Fee Collection');
  const [externalRef, setExternalRef] = useState('');
  const [maxClicks, setMaxClicks] = useState<number | undefined>(undefined);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const { defaultDomain } = useTenantDomains();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dto: CreateLinkDto = {
        destinationUrl,
        alias: alias.trim() || undefined,
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
    setCreatedData(null);
    setError(null);
    onClose();
  };

  const handleCopy = () => {
    if (!createdData) return;
    const url = createdData.shortUrl || `https://${defaultDomain}/${createdData.shortCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-14 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-[#E42527]">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                {createdData ? 'Link Created!' : 'Create Short Link'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {createdData ? 'Your short link is ready.' : 'Create a new short link.'}
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
        <div className="p-5 text-xs">
          {createdData ? (
            /* Success State */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-3">
                <div className="text-slate-500 font-semibold text-[10px] uppercase">
                  Short URL
                </div>
                <div className="flex items-center gap-2 bg-white p-2.5 rounded border border-emerald-300 font-mono text-sm font-bold text-blue-600">
                  <span className="truncate flex-1">
                    {createdData.shortUrl || `https://${defaultDomain}/${createdData.shortCode}`}
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
                  <span>Length: <strong>18 characters</strong></span>
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
                  type="url"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://jupsoft.com/econnect/fees/pay?inv=INV-2026-9021"
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
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="annual-fees-26"
                      className="w-full text-xs px-2.5 py-2 rounded-r border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Campaign Tag
                  </label>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="Fee Collection">Fee Collection</option>
                    <option value="Admissions 2026">Admissions 2026</option>
                    <option value="Transport Alert">Transport Alert</option>
                    <option value="Exam Circular">Exam Circular</option>
                    <option value="Annual Day">Annual Day / Sports</option>
                    <option value="General Notice">General Notice</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    External Ref
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
                  className="px-4 py-2 rounded bg-[#E42527] hover:bg-[#c91e20] text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
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
