'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  GraduationCap,
  Bus,
  FileCheck,
  Tag,
  Copy,
  Check,
  Zap,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { api, exportToCsv } from '../../api';
import { Permissions } from '../../utils/rbac';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';

interface BatchRow {
  destinationUrl: string;
  alias: string;
  tag: string;
  externalRef: string;
}

interface BulkStudioViewProps {
  currentUser?: any;
}

export const BulkStudioView: React.FC<BulkStudioViewProps> = ({ currentUser }) => {
  // URL Normalization & Validation Helper
  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const isValidUrl = (url: string) => {
    if (!url || !url.trim()) return false;
    try {
      const full = normalizeUrl(url);
      const parsed = new URL(full);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.');
    } catch {
      return false;
    }
  };

  // Start with 1 blank row
  const [batchRows, setBatchRows] = useState<BatchRow[]>([
    {
      destinationUrl: '',
      alias: '',
      tag: 'General',
      externalRef: '',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobInfo, setJobInfo] = useState<{ jobId: string; totalCount: number; status: string } | null>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Quick Test Generator State (Presets: 500 / 1000 links, Tag: bulktest)
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [customCount, setCustomCount] = useState<number>(500);
  const [customTag, setCustomTag] = useState<string>('bulktest');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('https://jupsoft.com/student/portal?id=');

  const pagination = usePagination(batchRows, 50);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const validRowsCount = batchRows.filter((r) => isValidUrl(r.destinationUrl)).length;
  const hasInvalidRows = batchRows.some(
    (r) => r.destinationUrl.trim().length > 0 && !isValidUrl(r.destinationUrl)
  );
  const canDispatch =
    validRowsCount > 0 &&
    !hasInvalidRows &&
    !isProcessing &&
    Permissions.canBulkCreate(currentUser?.role);

  // Add new editable row
  const handleAddRow = () => {
    setBatchRows((prev) => [
      ...prev,
      {
        destinationUrl: '',
        alias: '',
        tag: 'General',
        externalRef: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (index: number, field: keyof BatchRow, val: string) => {
    setBatchRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    );
  };

  // Quick preset category tag applicator (sets category tag without injecting mock URLs or dummy invoices)
  const applyPresetTag = (tag: string) => {
    setBatchRows((prev) => {
      if (prev.length === 0) {
        return [{ destinationUrl: '', alias: '', tag, externalRef: '' }];
      }
      return prev.map((r) => ({ ...r, tag }));
    });
  };

  // Handle CSV file upload directly into visual grid
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n');
        if (lines.length < 2) return;

        const newRows: BatchRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols[0]) {
            newRows.push({
              destinationUrl: cols[0],
              alias: cols[1] || '',
              tag: cols[2] || 'General',
              externalRef: cols[3] || '',
            });
          }
        }
        if (newRows.length > 0) setBatchRows(newRows);
      } catch (err: any) {
        setErrorMsg('Error reading uploaded CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Dispatch Batch Creation
  const handleStartBulk = async () => {
    const validItems = batchRows.filter((r) => isValidUrl(r.destinationUrl));
    if (validItems.length === 0) {
      setErrorMsg('Please enter at least one valid destination URL (starting with http:// or https://).');
      return;
    }
    if (hasInvalidRows) {
      setErrorMsg('Please correct the invalid URL highlighted in red before dispatching.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const items = validItems.map((r) => ({
        destinationUrl: r.destinationUrl.trim(),
        alias: r.alias.trim() || undefined,
        tag: r.tag || undefined,
        externalRef: r.externalRef.trim() || undefined,
      }));

      const res = await api.bulkCreate(items);
      if (res.success && res.data) {
        const jobId = res.data.jobId;
        const totalCount = res.data.totalCount || items.length;
        const status = res.data.status || 'queued';
        setJobInfo({ jobId, totalCount, status });

        if (res.data.results) {
          setBatchResults(res.data.results);
          setIsProcessing(false);
        } else {
          pollStatus(jobId, totalCount);
        }
      } else {
        setErrorMsg(res.error?.message || 'Failed to trigger bulk processing.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing bulk link creation.');
      setIsProcessing(false);
    }
  };

  const pollStatus = (jobId: string, totalCount: number) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.getBulkStatus(jobId);
        if (res && res.success && res.data) {
          const status = res.data.status;
          const result = res.data.result;

          setJobInfo({ jobId, totalCount, status: status || 'processing' });

          if (status === 'completed' || status === 'failed' || result) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsProcessing(false);

            const created = result?.results || result?.created || [];
            if (Array.isArray(created) && created.length > 0) {
              setBatchResults(created);
            }
          }
        }
      } catch {
        // keep polling
      }

      if (attempts >= 40) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsProcessing(false);
        setErrorMsg('Bulk processing is taking longer than expected. Please check back later.');
      }
    }, 1500);
  };

  const downloadSampleTemplate = () => {
    const sample = `destination_url,alias,tag,external_ref\nhttps://example.com/pay?inv=INV-2026-001,pay-001,Payment,INV-2026-001\nhttps://example.com/pay?inv=INV-2026-002,pay-002,Payment,INV-2026-002\nhttps://example.com/offer/summer,summer-offer,Marketing,CMP-2026-01`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jlmp_bulk_links_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePopulateTestBatch = (count: number, tag: string, baseUrl: string) => {
    const cleanTag = tag.trim() || 'bulktest';
    const cleanUrl = baseUrl.trim() || 'https://jupsoft.com/student/portal?id=';
    const newRows: BatchRow[] = [];
    for (let i = 1; i <= count; i++) {
      const pad = String(i).padStart(5, '0');
      newRows.push({
        destinationUrl: `${cleanUrl}STD-${pad}&session=2026-27`,
        alias: '',
        tag: cleanTag,
        externalRef: `BULK-${cleanTag.toUpperCase()}-${pad}`,
      });
    }
    setBatchRows(newRows);
    pagination.setCurrentPage(1);
    setShowBatchModal(false);
  };

  const handleDownloadCustomCsv = (count: number, tag: string, baseUrl: string) => {
    const cleanTag = tag.trim() || 'bulktest';
    const cleanUrl = baseUrl.trim() || 'https://jupsoft.com/student/portal?id=';
    const rows = ['destination_url,alias,tag,external_ref'];
    for (let i = 1; i <= count; i++) {
      const pad = String(i).padStart(5, '0');
      rows.push(`${cleanUrl}STD-${pad}&session=2026-27,,${cleanTag},BULK-${cleanTag.toUpperCase()}-${pad}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jupsoft_bulk_${count}_${cleanTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportResults = () => {
    if (batchResults.length === 0) return;
    exportToCsv('jlmp_bulk_created_links', batchResults);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Top Action & Context Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900">
            Bulk Link Creation
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {Permissions.canBulkCreate(currentUser?.role) && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Generate 500 or 1,000 links in one click"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              Auto-Generate Test Batch
            </button>
          )}
          {Permissions.canBulkCreate(currentUser?.role) && (
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Upload CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
          <button
            onClick={downloadSampleTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Download Template
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Overview & Queue Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quick Instructions & Quick Category Tags */}
        <div className="lg:col-span-8 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-900">
              Batch Staging ({batchRows.length} {batchRows.length === 1 ? 'row' : 'rows'})
            </span>
            <span className="text-xs text-slate-500">
              {validRowsCount} valid for dispatch
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              Quickly apply a common category tag to your batch or upload a CSV file with destination URLs, aliases, and tags:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {['bulktest', 'General', 'Fees Collection', 'Report Cards', 'Payment', 'Notification'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => applyPresetTag(tag)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                    tag === 'bulktest'
                      ? 'border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold'
                      : 'border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Set all to {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Dispatch Action & Queue Monitor */}
        <div className="lg:col-span-4 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Batch Processing
              </span>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                Ready to Process
              </span>
            </div>

            {jobInfo ? (
              <div className="mt-2 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900">Job Status</span>
                  <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                    {jobInfo.status}
                  </span>
                </div>
                <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full bg-emerald-600 rounded-full ${
                      isProcessing ? 'animate-pulse w-3/4' : 'w-full'
                    }`}
                  ></div>
                </div>
                <div className="text-[10px] text-emerald-800 font-mono">
                  {jobInfo.totalCount} Links Submitted to Queue
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Review the {batchRows.length} {batchRows.length === 1 ? 'link' : 'links'} in the spreadsheet below and click Dispatch to mint short codes in parallel.
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-2">
            {Permissions.canBulkCreate(currentUser?.role) ? (
              <button
                onClick={handleStartBulk}
                disabled={!canDispatch}
                aria-label="Dispatch Batch Creation"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded text-xs font-bold shadow-xs transition bg-[#0F6CBD] hover:bg-[#0c599b] text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Processing In Background...
                  </>
                ) : validRowsCount === 0 ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current opacity-60" />
                    Enter Valid URL To Dispatch
                  </>
                ) : hasInvalidRows ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 opacity-60" />
                    Fix Invalid URLs in Table
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Dispatch Batch ({validRowsCount} {validRowsCount === 1 ? 'Link' : 'Links'})
                  </>
                )}
              </button>
            ) : (
              <div className="w-full py-2 px-3 text-center bg-slate-100 border border-slate-200 rounded text-xs text-slate-500 font-medium">
                Read-only auditor mode: Bulk creation disabled
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Interactive Spreadsheet Table (REPLACED RAW TEXTAREA) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Links ({batchRows.length} Rows)
            </span>
            <span className="text-[11px] text-slate-400">
              Paste or edit rows directly
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Apply to all rows category dropdown above the grid */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs">
              <label htmlFor="bulk-apply-all-category" className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                Apply to all rows:
              </label>
              <select
                id="bulk-apply-all-category"
                aria-label="Apply to all rows category"
                className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-h-[36px] sm:min-h-0"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setBatchRows((prev) => {
                      const hasNonEmpty = prev.some(
                        (r) =>
                          r.destinationUrl.trim().length > 0 ||
                          r.alias.trim().length > 0 ||
                          r.externalRef.trim().length > 0
                      );
                      if (!hasNonEmpty) {
                        return prev.map((r) => ({ ...r, tag: val }));
                      }
                      return prev.map((r) => {
                        const isNonEmpty =
                          r.destinationUrl.trim().length > 0 ||
                          r.alias.trim().length > 0 ||
                          r.externalRef.trim().length > 0;
                        return isNonEmpty ? { ...r, tag: val } : r;
                      });
                    });
                    e.target.value = '';
                  }
                }}
              >
                <option value="">Select category...</option>
                <option value="bulktest">bulktest (Test Suite)</option>
                <option value="General">General</option>
                <option value="Fees Collection">Fees Collection</option>
                <option value="Report Cards">Report Cards</option>
                <option value="Marketing">Marketing</option>
                <option value="Payment">Payment</option>
                <option value="Notification">Notification</option>
                <option value="Support">Support</option>
              </select>
            </div>

            {Permissions.canBulkCreate(currentUser?.role) && (
              <button
                onClick={handleAddRow}
                aria-label="Add Link Row"
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition min-h-[40px] sm:min-h-0"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Add Link Row
              </button>
            )}
            {batchResults.length > 0 && (
              <button
                onClick={handleExportResults}
                aria-label="Export Results"
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition min-h-[40px] sm:min-h-0"
              >
                <Download className="w-3.5 h-3.5" /> Export Results
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5 w-12 text-center">#</th>
                <th className="px-3.5 py-2.5">Destination URL</th>
                <th className="px-3.5 py-2.5 w-44">Alias</th>
                <th className="px-3.5 py-2.5 w-48 whitespace-nowrap">
                  Campaign Category
                </th>
                <th className="px-3.5 py-2.5 w-40">External Ref</th>
                <th className="px-3.5 py-2.5 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {pagination.paginatedItems.map((row, pageIdx) => {
                const idx = (pagination.currentPage - 1) * pagination.pageSize + pageIdx;
                const hasContent = row.destinationUrl.trim().length > 0;
                const isUrlValid = isValidUrl(row.destinationUrl);
                const isInvalid = hasContent && !isUrlValid;

                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-2 text-center font-mono text-slate-400 text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Long Destination URL Input with Inline Error */}
                    <td className="px-3.5 py-2">
                      <input
                        type="text"
                        value={row.destinationUrl}
                        onChange={(e) => handleUpdateRow(idx, 'destinationUrl', e.target.value)}
                        placeholder="https://example.com, www.example.com or example.com"
                        className={`w-full text-xs px-2.5 py-1.5 rounded border transition focus:outline-hidden ${
                          isInvalid
                            ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white'
                        }`}
                      />
                      {isInvalid && (
                        <span className="text-[10px] text-red-600 block mt-0.5 font-medium">
                          Invalid URL: must begin with http:// or https://
                        </span>
                      )}
                    </td>

                    {/* Alias Input */}
                    <td className="px-3.5 py-2">
                      <div className="flex items-center">
                        <span className="bg-slate-100 border border-r-0 border-slate-200 px-1.5 py-1.5 rounded-l text-[10px] text-slate-400 font-mono">
                          /
                        </span>
                        <input
                          type="text"
                          value={row.alias}
                          onChange={(e) => handleUpdateRow(idx, 'alias', e.target.value)}
                          placeholder="custom-slug"
                          className="w-full text-xs px-2 py-1.5 rounded-r border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-blue-600 font-semibold"
                        />
                      </div>
                    </td>

                    {/* Campaign Category Dropdown */}
                    <td className="px-3.5 py-2">
                      <select
                        value={row.tag}
                        onChange={(e) => handleUpdateRow(idx, 'tag', e.target.value)}
                        className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        <option value="bulktest">bulktest</option>
                        <option value="General">General</option>
                        <option value="Fees Collection">Fees Collection</option>
                        <option value="Report Cards">Report Cards</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Payment">Payment</option>
                        <option value="Notification">Notification</option>
                        <option value="Support">Support</option>
                      </select>
                    </td>

                    {/* ERP Invoice / External Ref */}
                    <td className="px-3.5 py-2">
                      <input
                        type="text"
                        value={row.externalRef}
                        onChange={(e) => handleUpdateRow(idx, 'externalRef', e.target.value)}
                        placeholder="INV-2026-001"
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </td>

                    {/* Row Delete Button */}
                    <td className="px-3.5 py-2 text-center">
                      <button
                        onClick={() => handleRemoveRow(idx)}
                        disabled={batchRows.length === 1}
                        aria-label={`Remove Row ${idx + 1}`}
                        title="Remove Row"
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed min-w-[40px] min-h-[40px] flex items-center justify-center mx-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination when rows exceed page size */}
        {batchRows.length > 50 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="staged links"
            />
          </div>
        )}
      </div>

      {/* Generated Batch Results Card */}
      {batchResults.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Batch Results ({batchResults.filter((r) => r.shortUrl).length} Created, {batchResults.filter((r) => r.error).length} Failed)
              </span>
            </div>
            <button
              onClick={handleExportResults}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="px-3.5 py-2 w-12 text-center">#</th>
                  <th className="px-3.5 py-2">Destination URL</th>
                  <th className="px-3.5 py-2">Generated Short URL</th>
                  <th className="px-3.5 py-2 w-32 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {batchResults.map((resItem, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-3.5 py-2 text-center font-mono text-slate-400 text-[11px]">{i + 1}</td>
                    <td className="px-3.5 py-2 truncate max-w-xs text-slate-600 font-mono text-[11px]">{resItem.destinationUrl}</td>
                    <td className="px-3.5 py-2 font-mono text-xs">
                      {resItem.shortUrl ? (
                        <a href={resItem.shortUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold">
                          {resItem.shortUrl}
                        </a>
                      ) : (
                        <span className="text-red-600 italic">{resItem.error || 'Failed'}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-center">
                      {resItem.shortUrl ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                          Created
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold text-[10px]">
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Test Generator Modal (Presets: 500 / 1000 links, Tag: bulktest) */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Auto-Generate Test Batch</h3>
                  <p className="text-[11px] text-slate-500">Generate 500 to 1,000 links in one click</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Quick Quantity Presets:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { count: 100, label: '100 Links' },
                  { count: 500, label: '500 Links' },
                  { count: 1000, label: '1,000 Links' },
                ].map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => {
                      setCustomCount(preset.count);
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition text-center cursor-pointer ${
                      customCount === preset.count
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Total Links Count:</label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campaign Tag (Default: bulktest):</label>
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="bulktest"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Base Destination URL:</label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://jupsoft.com/student/portal?id="
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Format: {customBaseUrl}STD-00001&session=2026-27
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handlePopulateTestBatch(customCount, customTag, customBaseUrl)}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                Populate Grid with {customCount} Links
              </button>

              <button
                type="button"
                onClick={() => handleDownloadCustomCsv(customCount, customTag, customBaseUrl)}
                className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Download Ready CSV ({customCount} Pre-filled Rows)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
