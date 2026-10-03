'use client';

import React, { useState } from 'react';
import {
  QrCode,
  Download,
  ExternalLink,
  Copy,
  Check,
  Sliders,
  Printer,
  Sparkles,
  Layers,
  Palette,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { LinkItem, API_BASE_URL } from '../../api';
import { useTenantDomains } from '../../hooks/useTenantDomains';

interface QrStudioViewProps {
  links: LinkItem[];
  selectedLink: LinkItem | null;
  onSelectLink: (link: LinkItem) => void;
}

export const QrStudioView: React.FC<QrStudioViewProps> = ({
  links,
  selectedLink,
  onSelectLink,
}) => {
  const [size, setSize] = useState<number>(320);
  const [qrTheme, setQrTheme] = useState<'navy' | 'black' | 'emerald'>('navy');
  const [copied, setCopied] = useState(false);

  const { defaultDomain } = useTenantDomains();

  // Fallback to first link if none selected
  const activeLink = selectedLink || (links.length > 0 ? links[0] : null);
  const shortUrl = activeLink ? `https://${defaultDomain}/${activeLink.short_code}` : '';

  const handleCopy = () => {
    if (!shortUrl) return;
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            QR Studio
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold px-2 py-0.5 rounded-full">
              Print Ready
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate and customize QR codes for your short links.
          </p>
        </div>

        {activeLink && (
          <div className="flex items-center gap-2">
            <a
              href={`${API_BASE_URL}/links/${activeLink.id}/qr?format=png&size=1024&theme=${qrTheme}`}
              download={`qr_${activeLink.short_code}_1024px.png`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download PNG (1024px)
            </a>
            <a
              href={`${API_BASE_URL}/links/${activeLink.id}/qr?format=svg&theme=${qrTheme}`}
              download={`qr_${activeLink.short_code}.svg`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Vector SVG
            </a>
          </div>
        )}
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Link Selector & Customizer Controls */}
        <div className="lg:col-span-5 bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              Settings
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Dynamic</span>
          </div>

          {/* Select Link Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Active Short Link
            </label>
            <select
              value={activeLink?.id || ''}
              onChange={(e) => {
                const found = links.find((l) => l.id === e.target.value);
                if (found) onSelectLink(found);
              }}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {links.map((link) => (
                <option key={link.id} value={link.id}>
                  {defaultDomain}/{link.short_code} ({link.tag || 'Notice'})
                </option>
              ))}
            </select>
          </div>

          {activeLink && (
            <div className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branded Short URL
                </label>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-xs font-mono font-bold text-blue-600 truncate flex-1">
                    {defaultDomain}/{activeLink.short_code}
                  </span>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy short link"
                    title="Copy short link"
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Target
                </label>
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 break-all font-mono">
                  {activeLink.destination_url}
                </div>
              </div>

              {/* Color Theme Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setQrTheme('navy')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      qrTheme === 'navy'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-[#0D233A]"></span>
                    Navy
                  </button>
                  <button
                    onClick={() => setQrTheme('black')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      qrTheme === 'black'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-slate-900"></span>
                    Standard
                  </button>
                  <button
                    onClick={() => setQrTheme('emerald')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      qrTheme === 'emerald'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                    Emerald
                  </button>
                </div>
              </div>

              {/* Size Slider */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Resolution</span>
                  <span className="font-mono text-blue-600">{size}px</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={480}
                  step={20}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Dynamic QR Active
                </span>
                <span>Error Correction: Level H (30%)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: High-Def Mockup Canvas */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center space-y-4">
          {activeLink ? (
            <>
              {/* Executive Acrylic Card Mockup */}
              <div className="relative p-6 bg-slate-50/70 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center max-w-sm w-full">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  Preview
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-center min-h-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${API_BASE_URL}/links/${activeLink.id}/qr?format=png&size=${size}&theme=${qrTheme}`}
                    alt={`QR Code for ${activeLink.short_code}`}
                    style={{ width: `${Math.min(size, 260)}px`, height: `${Math.min(size, 260)}px` }}
                    className="object-contain"
                  />
                </div>

                <div className="mt-3 text-center space-y-0.5">
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {defaultDomain}/{activeLink.short_code}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Scan with any mobile camera to open target notice
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`https://${defaultDomain}/${activeLink.short_code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  Test Live Redirect
                </a>

                <a
                  href={`${API_BASE_URL}/links/${activeLink.id}/qr?format=png&size=1024&theme=${qrTheme}`}
                  download={`qr_${activeLink.short_code}_1024px.png`}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download 1024px PNG
                </a>

                <a
                  href={`${API_BASE_URL}/links/${activeLink.id}/qr?format=svg&theme=${qrTheme}`}
                  download={`qr_${activeLink.short_code}.svg`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Vector SVG
                </a>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700">No link selected</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Select a short link from the dropdown on the left.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
