'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { LinkItem, API_BASE_URL } from '../../api';
import { useTenantDomains, buildShortUrl } from '../../hooks/useTenantDomains';

interface CanvasDrawerProps {
  link: LinkItem | null;
  onClose: () => void;
  onArchive: (id: string) => void;
}

export const CanvasDrawer: React.FC<CanvasDrawerProps> = ({ link, onClose, onArchive }) => {
  const [copied, setCopied] = useState(false);
  const { defaultDomain } = useTenantDomains();

  if (!link) return null;

  const shortUrl = buildShortUrl(defaultDomain, link.short_code);

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200 select-none">
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
            <div className="text-xs font-bold font-mono text-emerald-700 capitalize mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {link.status}
            </div>
          </div>
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
          <button
            onClick={() => onArchive(link.id)}
            className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold text-center transition"
          >
            Archive Short Link
          </button>
        </div>
      </div>
    </div>
  );
};
