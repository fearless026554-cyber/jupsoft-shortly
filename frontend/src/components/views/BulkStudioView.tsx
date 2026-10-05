'use client';

import React, { useState } from 'react';
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
  Sparkles,
  Layers,
  GraduationCap,
  Bus,
  FileCheck,
  Tag,
  Copy,
  Check,
} from 'lucide-react';
import { api, exportToCsv } from '../../api';
import { Permissions } from '../../utils/rbac';

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
  // URL Validation Helper
  const isValidUrl = (url: string) => {
    if (!url || !url.trim()) return false;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Start with 1 blank row
  const [batchRows, setBatchRows] = useState<BatchRow[]>([
    {
      destinationUrl: '',
      alias: '',
      tag: 'Fee Collection',
      externalRef: '',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobInfo, setJobInfo] = useState<{ jobId: string; totalCount: number; status: string } | null>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        tag: 'Fee Collection',
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
              tag: cols[2] || 'Fee Collection',
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
        setJobInfo(res.data);
        if (res.data.results) {
          setBatchResults(res.data.results);
          setIsProcessing(false);
        } else {
          pollStatus(res.data.jobId);
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

  const pollStatus = async (jobId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.getBulkStatus(jobId);
        if (res && res.success && res.data) {
          setJobInfo((prev) => (prev ? { ...prev, status: res.data.status } : null));
          if (res.data.status === 'completed' || res.data.result) {
            clearInterval(interval);
            setIsProcessing(false);
            if (res.data.result?.created) {
              setBatchResults(res.data.result.created);
            }
          }
        }
      } catch {
        // keep polling
      }
      if (attempts > 20) {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 1500);
  };

  const downloadSampleTemplate = () => {
    const sample = `destination_url,alias,tag,external_ref\nhttps://jupsoft.com/fees/pay?inv=INV-2026-001,fee-std1-001,Class 10 Fees,INV-2026-001\nhttps://jupsoft.com/fees/pay?inv=INV-2026-002,fee-std1-002,Class 10 Fees,INV-2026-002\nhttps://jupsoft.com/notice/parent-teacher-meet,ptm-april,Academic Notices,PTM-APR-26`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jlmp_bulk_links_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportResults = () => {
    if (batchResults.length === 0) return;
    exportToCsv('jlmp_bulk_created_links', batchResults);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Compact Action & Context Strip (Height ~36px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Bulk Create Workspace
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-500 font-mono truncate">
            Batch Processing
          </span>
        </div>

        <div className="flex items-center gap-2">
          {Permissions.canBulkCreate(currentUser?.role) && (
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider shadow-2xs transition-colors cursor-pointer">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Template
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preset Campaign Chips & Queue Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quick Preset Selection Cards */}
        <div className="lg:col-span-8 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Campaign Category Tags
            </span>
            <span className="text-[11px] text-slate-400">
              {batchRows.length} {batchRows.length === 1 ? 'Link' : 'Links'} in Staging
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => applyPresetTag('Fee Collection')}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300 text-left transition flex items-start gap-2.5"
            >
              <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Fee Collection</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tag: Fee Collection</div>
              </div>
            </button>

            <button
              onClick={() => applyPresetTag('Transport Alert')}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50/60 hover:border-emerald-300 text-left transition flex items-start gap-2.5"
            >
              <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Bus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Transport Alerts</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tag: Transport Alert</div>
              </div>
            </button>

            <button
              onClick={() => applyPresetTag('Admissions 2026')}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50/60 hover:border-purple-300 text-left transition flex items-start gap-2.5"
            >
              <div className="w-7 h-7 rounded bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Admissions 2026</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tag: Admissions 2026</div>
              </div>
            </button>
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

          <div className="flex items-center gap-2">
            {Permissions.canBulkCreate(currentUser?.role) && (
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Add Link Row
              </button>
            )}
            {batchResults.length > 0 && (
              <button
                onClick={handleExportResults}
                className="flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition"
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
                  <div className="flex items-center gap-1.5">
                    Campaign Category
                    <select
                      className="text-[9px] font-normal px-1 py-0.5 rounded border border-slate-300 bg-white text-slate-500 focus:outline-none"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setBatchRows(prev => prev.map(r => ({ ...r, tag: val })));
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">Apply all...</option>
                      <option value="Fee Collection">Fee Collection</option>
                      <option value="Transport Alert">Transport Alert</option>
                      <option value="Admissions 2026">Admissions 2026</option>
                      <option value="Exam Notices">Exam Notices</option>
                      <option value="Annual Day">Annual Day</option>
                    </select>
                  </div>
                </th>
                <th className="px-3.5 py-2.5 w-40">External Ref</th>
                <th className="px-3.5 py-2.5 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {batchRows.map((row, idx) => {
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
                        type="url"
                        value={row.destinationUrl}
                        onChange={(e) => handleUpdateRow(idx, 'destinationUrl', e.target.value)}
                        placeholder="https://jupsoft.com/fees/..."
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
                          placeholder="fee-std1"
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
                        <option value="Fee Collection">Fee Collection</option>
                        <option value="Transport Alert">Transport Alert</option>
                        <option value="Admissions 2026">Admissions 2026</option>
                        <option value="Exam Notices">Exam Notices</option>
                        <option value="Annual Day">Annual Day</option>
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
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
};
