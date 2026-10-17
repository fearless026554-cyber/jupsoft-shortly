'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Tag,
  Copy,
  Check,
  Zap,
  X,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Wand2,
  FileText,
  ArrowRight,
  Search,
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

interface JobInfo {
  jobId: string;
  totalCount: number;
  status: 'queued' | 'active' | 'processing' | 'completed' | 'cancelled' | 'failed';
  progress: number;
  completedCount: number;
  failedCount: number;
  startTime: number;
  speed: number;
  elapsedSeconds: number;
}

interface BulkStudioViewProps {
  currentUser?: any;
  activeTenantId?: string;
}

export const BulkStudioView: React.FC<BulkStudioViewProps> = ({ currentUser, activeTenantId }) => {
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
  const [isStopping, setIsStopping] = useState(false);
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [customCount, setCustomCount] = useState<number>(500);
  const [customTag, setCustomTag] = useState<string>('bulktest');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('https://jupsoft.com/student/portal?id=');

  // Search within generated results
  const [resultFilter, setResultFilter] = useState<'all' | 'created' | 'failed'>('all');
  const [resultSearch, setResultSearch] = useState('');

  const pagination = usePagination(batchRows, 50);

  // Clean up polling & timer on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  // Compute live dynamic batch metrics
  const validRowsCount = useMemo(() => {
    return batchRows.filter((r) => isValidUrl(r.destinationUrl)).length;
  }, [batchRows]);

  const invalidRowsCount = useMemo(() => {
    return batchRows.filter((r) => r.destinationUrl.trim().length > 0 && !isValidUrl(r.destinationUrl)).length;
  }, [batchRows]);

  const withAliasCount = useMemo(() => {
    return batchRows.filter((r) => r.alias.trim().length > 0).length;
  }, [batchRows]);

  const hasInvalidRows = invalidRowsCount > 0;
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
    setBatchRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleUpdateRow = (index: number, field: keyof BatchRow, val: string) => {
    setBatchRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    );
  };

  // Quick preset category tag applicator
  const applyPresetTag = (tag: string) => {
    setBatchRows((prev) => {
      if (prev.length === 0) {
        return [{ destinationUrl: '', alias: '', tag, externalRef: '' }];
      }
      return prev.map((r) => ({ ...r, tag }));
    });
  };

  // Dynamic Auto-Fix: Adds https:// to all protocol-less URLs and trims spaces
  const handleAutoFixProtocols = () => {
    let fixedCount = 0;
    setBatchRows((prev) =>
      prev.map((r) => {
        const trimmed = r.destinationUrl.trim();
        if (trimmed && !/^https?:\/\//i.test(trimmed)) {
          fixedCount++;
          return { ...r, destinationUrl: `https://${trimmed}` };
        }
        return { ...r, destinationUrl: trimmed };
      })
    );
    if (fixedCount > 0) {
      setSuccessMsg(`Auto-fixed protocols for ${fixedCount} ${fixedCount === 1 ? 'URL' : 'URLs'}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  // Remove all invalid rows in one click
  const handleRemoveInvalidRows = () => {
    const valid = batchRows.filter((r) => r.destinationUrl.trim().length === 0 || isValidUrl(r.destinationUrl));
    setBatchRows(valid.length > 0 ? valid : [{ destinationUrl: '', alias: '', tag: 'General', externalRef: '' }]);
    setSuccessMsg('Removed all invalid rows.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Clear all staged rows back to clean initial state
  const handleClearGrid = () => {
    setBatchRows([
      {
        destinationUrl: '',
        alias: '',
        tag: 'General',
        externalRef: '',
      },
    ]);
    pagination.setCurrentPage(1);
    setSuccessMsg('Staging grid reset to 1 clean row.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Handle Raw URLs Paste Import
  const handleProcessPastedUrls = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const newRows: BatchRow[] = lines.map((line, idx) => {
      // Split on comma or tab if CSV-like, otherwise treat entire line as URL
      let dest = line;
      let alias = '';
      let tag = 'General';
      let externalRef = '';

      if (line.includes(',') || line.includes('\t')) {
        const delimiter = line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));
        dest = parts[0] || '';
        alias = parts[1] || '';
        tag = parts[2] || 'General';
        externalRef = parts[3] || '';
      }

      dest = normalizeUrl(dest);

      return {
        destinationUrl: dest,
        alias,
        tag,
        externalRef: externalRef || `PASTE-${String(idx + 1).padStart(4, '0')}`,
      };
    });

    setBatchRows(newRows);
    pagination.setCurrentPage(1);
    setShowPasteModal(false);
    setPastedText('');
    setSuccessMsg(`Imported ${newRows.length} links from pasted text.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Handle CSV file upload directly into visual grid
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return;

        const newRows: BatchRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols[0]) {
            newRows.push({
              destinationUrl: normalizeUrl(cols[0]),
              alias: cols[1] || '',
              tag: cols[2] || 'General',
              externalRef: cols[3] || '',
            });
          }
        }
        if (newRows.length > 0) {
          setBatchRows(newRows);
          pagination.setCurrentPage(1);
          setSuccessMsg(`Successfully imported ${newRows.length} links from CSV file.`);
          setTimeout(() => setSuccessMsg(null), 3500);
        }
      } catch (err: any) {
        setErrorMsg('Error reading uploaded CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Dispatch Batch Creation
  const handleStartBulk = async () => {
    const validItems = batchRows.filter((r) => isValidUrl(r.destinationUrl));
    if (validItems.length === 0) {
      setErrorMsg('Please enter at least one valid destination URL (starting with http:// or https://).');
      return;
    }
    if (hasInvalidRows) {
      setErrorMsg('Please correct the invalid URL highlighted in red or click "Auto-Fix URLs" before dispatching.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const startTime = Date.now();
    const totalCount = validItems.length;

    try {
      const items = validItems.map((r) => ({
        destinationUrl: r.destinationUrl.trim(),
        alias: r.alias.trim() || undefined,
        tag: r.tag || undefined,
        externalRef: r.externalRef.trim() || undefined,
      }));

      const res = await api.bulkCreate(items, activeTenantId && activeTenantId !== 'all' ? activeTenantId : undefined);
      if (res.success && res.data) {
        const jobId = res.data.jobId;
        const status = (res.data.status as any) || 'queued';

        const initialJobInfo: JobInfo = {
          jobId,
          totalCount,
          status,
          progress: 5,
          completedCount: 0,
          failedCount: 0,
          startTime,
          speed: 0,
          elapsedSeconds: 0,
        };

        setJobInfo(initialJobInfo);

        if (res.data.results && Array.isArray(res.data.results)) {
          setBatchResults(res.data.results);
          setIsProcessing(false);
          setJobInfo((prev) => (prev ? { ...prev, progress: 100, status: 'completed', completedCount: res.data.results.length } : null));
        } else {
          startPollingAndTimer(jobId, totalCount, startTime);
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

  // Stop / Cancel active bulk batch with graceful results preservation
  const handleStopBulk = async () => {
    if (!jobInfo?.jobId || !isProcessing || isStopping) return;

    try {
      setIsStopping(true);

      // 1. Transmit cancellation signal to backend
      await api.cancelBulkJob(jobInfo.jobId);

      // 2. Poll for the workers to acknowledge cancellation and rollback (up to 4s)
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const res = await api.getBulkStatus(jobInfo.jobId).catch(() => null);
        if (res?.success && (res.data?.status === 'cancelled' || res.data?.result?.cancelled)) {
          break;
        }
      }

      // 3. Halt polling & timer
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setIsProcessing(false);
      setIsStopping(false);
      setBatchResults([]);
      setJobInfo((prev) =>
        prev
          ? {
              ...prev,
              status: 'cancelled',
              completedCount: 0,
              failedCount: 0,
            }
          : null
      );
      setSuccessMsg('Bulk batch processing stopped. All partially created links have been rolled back and not saved to Supabase.');
    } catch (err: any) {
      setIsStopping(false);
      setIsProcessing(false);
      setErrorMsg('Error sending cancellation signal: ' + err.message);
    }
  };

  // Polling with real-time speed & progress calculations
  const startPollingAndTimer = (jobId: string, totalCount: number, startTime: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Live Stopwatch Timer
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      setJobInfo((prev) => {
        if (!prev) return null;
        const currentProgress = prev.progress;
        const estProcessed = Math.round((currentProgress / 100) * totalCount);
        const speed = Math.round((estProcessed / elapsed) * 10) / 10;
        return {
          ...prev,
          elapsedSeconds: elapsed,
          speed,
        };
      });
    }, 500);

    // Fast-poll worker progress every 750ms
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.getBulkStatus(jobId);
        if (res && res.success && res.data) {
          const rawStatus = res.data.status;
          const rawProgress = typeof res.data.progress === 'number' ? res.data.progress : 0;
          const result = res.data.result;

          const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const completedCount = result?.completed ?? Math.round((rawProgress / 100) * totalCount);
          const failedCount = result?.failed ?? 0;
          const speed = Math.round((completedCount / elapsed) * 10) / 10;

          // Clamp progress
          const progress = rawStatus === 'completed' ? 100 : Math.max(5, Math.min(rawProgress, 99));

          setJobInfo({
            jobId,
            totalCount,
            status: rawStatus === 'completed' ? 'completed' : rawStatus === 'cancelled' ? 'cancelled' : 'processing',
            progress,
            completedCount,
            failedCount,
            startTime,
            speed,
            elapsedSeconds: elapsed,
          });

          if (rawStatus === 'completed' || rawStatus === 'cancelled' || rawStatus === 'failed' || result) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            setIsProcessing(false);

            if (rawStatus === 'cancelled' || result?.cancelled) {
              setBatchResults([]);
              setJobInfo((prev) => (prev ? { ...prev, status: 'cancelled', completedCount: 0 } : null));
              setSuccessMsg('Bulk batch processing stopped. All partially created links were rolled back and not saved to Supabase.');
            } else {
              const created = result?.results || result?.created || [];
              if (Array.isArray(created) && created.length > 0) {
                setBatchResults(created);
              }

              if (rawStatus === 'completed') {
                setSuccessMsg(`Batch completed successfully! ${completedCount} links created in ${elapsed}s.`);
              }
            }
          }
        }
      } catch {
        // Continue polling
      }

      if (attempts >= 150) {
        // Max 2 minutes polling
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setIsProcessing(false);
        setErrorMsg('Batch processing took longer than expected. Please check back later or refresh.');
      }
    }, 750);
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
    setSuccessMsg(`Generated ${count} test links staged for dispatch.`);
    setTimeout(() => setSuccessMsg(null), 3000);
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

  // Filter batch results
  const filteredResults = useMemo(() => {
    return batchResults.filter((r) => {
      if (resultFilter === 'created' && !r.shortUrl) return false;
      if (resultFilter === 'failed' && r.shortUrl) return false;
      if (resultSearch.trim()) {
        const query = resultSearch.toLowerCase().trim();
        const matchesDest = (r.destinationUrl || '').toLowerCase().includes(query);
        const matchesShort = (r.shortUrl || '').toLowerCase().includes(query);
        const matchesRef = (r.externalRef || '').toLowerCase().includes(query);
        return matchesDest || matchesShort || matchesRef;
      }
      return true;
    });
  }, [batchResults, resultFilter, resultSearch]);

  const resultsPagination = usePagination(filteredResults, 25);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-4 w-full">
      {/* Top Action & Context Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              Bulk Link Studio
            </h1>
            <p className="text-[11px] text-slate-400">
              High-throughput multi-threaded link minting engine
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {Permissions.canBulkCreate(currentUser?.role) && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Generate 100, 500, or 1,000 links in one click"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
              Auto-Generate Test Batch
            </button>
          )}

          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            title="Paste multiple URLs from clipboard"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            Paste URLs
          </button>

          {Permissions.canBulkCreate(currentUser?.role) && (
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Upload CSV
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            title="Download CSV format template"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Template
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Overview & Live Real-Time Progress Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Dynamic Batch Staging Summary & Tags */}
        <div className="lg:col-span-7 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Batch Staging
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700 font-semibold">
                {batchRows.length} {batchRows.length === 1 ? 'row' : 'rows'}
              </span>
            </div>

            {/* Dynamic Metric Pills */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                validRowsCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
              }`}>
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {validRowsCount} Valid
              </span>

              {invalidRowsCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 animate-pulse">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  {invalidRowsCount} Invalid
                </span>
              )}

              {withAliasCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  <Tag className="w-3 h-3 text-purple-500" />
                  {withAliasCount} Custom
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 font-medium">
                Quick Category Tag Applicator:
              </p>
              {invalidRowsCount > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFixProtocols}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" /> Auto-Fix URLs (Add https://)
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                  Set to {tag}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Paste URLs or upload CSV to quickly populate this staging queue.</span>
              <div className="flex items-center gap-3">
                {invalidRowsCount > 0 && (
                  <button
                    onClick={handleRemoveInvalidRows}
                    className="text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                  >
                    Remove Invalid
                  </button>
                )}
                <button
                  onClick={handleClearGrid}
                  className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Dynamic Batch Processing Card with REAL-TIME Progress & STOP Button */}
        <div className="lg:col-span-5 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Live Dispatch Monitor
              </span>

              {/* Dynamic Status Badge */}
              {isProcessing ? (
                <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Processing ({jobInfo?.progress || 0}%)
                </span>
              ) : jobInfo?.status === 'completed' ? (
                <span className="text-[11px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Completed
                </span>
              ) : jobInfo?.status === 'cancelled' ? (
                <span className="text-[11px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Square className="w-3 h-3 text-amber-600 fill-amber-600" />
                  Stopped
                </span>
              ) : hasInvalidRows ? (
                <span className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Fix URLs
                </span>
              ) : validRowsCount > 0 ? (
                <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Ready ({validRowsCount} links)
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                  Awaiting Input
                </span>
              )}
            </div>

            {/* REAL-TIME PROGRESS MONITOR */}
            {jobInfo ? (
              <div className="mt-2.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                {/* Metric Header */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <span>{jobInfo.completedCount} / {jobInfo.totalCount} Minted</span>
                    {jobInfo.failedCount > 0 && (
                      <span className="text-red-600">({jobInfo.failedCount} failed)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isProcessing && jobInfo.speed > 0 && (
                      <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px] font-bold">
                        ~{jobInfo.speed} links/s
                      </span>
                    )}
                    <span className="font-bold text-slate-900">{jobInfo.progress}%</span>
                  </div>
                </div>

                {/* Animated Dynamic Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      isProcessing
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 shadow-sm animate-pulse'
                        : jobInfo.status === 'completed'
                        ? 'bg-emerald-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.max(jobInfo.progress, isProcessing ? 5 : 0)}%` }}
                  ></div>
                </div>

                {/* Live Timing & Status Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Elapsed: {formatSeconds(jobInfo.elapsedSeconds || 1)}
                  </span>
                  <span>
                    {isProcessing ? (
                      <span className="text-blue-600 font-semibold animate-pulse">Parallel Workers Active</span>
                    ) : jobInfo.status === 'completed' ? (
                      <span className="text-emerald-700 font-bold">All Links Generated</span>
                    ) : (
                      <span className="text-amber-700 font-medium">Processing Cancelled</span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-500 leading-relaxed space-y-1">
                <p>
                  Review the {batchRows.length} {batchRows.length === 1 ? 'link' : 'links'} staged below. When ready, click Dispatch to mint short codes concurrently.
                </p>
                <div className="text-[11px] text-blue-600 font-medium flex items-center gap-1 pt-1">
                  <Zap className="w-3 h-3" />
                  Processes 500 links in under 20 seconds with live concurrency.
                </div>
              </div>
            )}
          </div>

          {/* Action Button Strip with STOP / CANCEL control */}
          <div className="pt-2 flex items-center gap-2">
            {isProcessing ? (
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-bold bg-blue-50 border border-blue-200 text-blue-800 shadow-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>
                    {isStopping
                      ? 'Stopping & Rolling Back Links...'
                      : `Minting Links (${jobInfo?.progress || 0}%)...`}
                  </span>
                </div>

                {/* STOP / CANCEL BUTTON */}
                <button
                  type="button"
                  onClick={handleStopBulk}
                  disabled={isStopping}
                  aria-label="Stop Bulk Processing"
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded text-xs font-bold shadow-xs transition bg-red-600 hover:bg-red-700 active:bg-red-800 text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title="Immediately abort the bulk creation job and discard partially created links"
                >
                  {isStopping ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Stopping...
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop Batch
                    </>
                  )}
                </button>
              </div>
            ) : Permissions.canBulkCreate(currentUser?.role) ? (
              <button
                onClick={handleStartBulk}
                disabled={!canDispatch}
                aria-label="Dispatch Batch Creation"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded text-xs font-bold shadow-xs transition bg-[#0F6CBD] hover:bg-[#0c599b] text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                {validRowsCount === 0 ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current opacity-60" />
                    Enter Valid URL To Dispatch
                  </>
                ) : hasInvalidRows ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
                    Fix Invalid URLs in Table ({invalidRowsCount})
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

      {/* Visual Interactive Spreadsheet Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Staged Links ({batchRows.length} Rows)
            </span>
            <span className="text-[11px] text-slate-400">
              Edit in-place or apply bulk tags
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Bulk Applicator Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs">
              <label htmlFor="bulk-apply-all-category" className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                Apply Category to All:
              </label>
              <select
                id="bulk-apply-all-category"
                aria-label="Apply category to all rows"
                className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setBatchRows((prev) => prev.map((r) => ({ ...r, tag: val })));
                    e.target.value = '';
                    setSuccessMsg(`Applied category "${val}" to all ${batchRows.length} rows.`);
                    setTimeout(() => setSuccessMsg(null), 2500);
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Add Row
              </button>
            )}

            {batchResults.length > 0 && (
              <button
                onClick={handleExportResults}
                aria-label="Export Results"
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Results ({batchResults.length})
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
                <th className="px-3.5 py-2.5 w-44">Alias (Optional)</th>
                <th className="px-3.5 py-2.5 w-44">Campaign Category</th>
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-red-600 font-medium">
                            Invalid URL: Must include domain (e.g. https://domain.com)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateRow(idx, 'destinationUrl', normalizeUrl(row.destinationUrl))}
                            className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            Add https://
                          </button>
                        </div>
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
                        className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
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
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center mx-auto"
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
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Generated Links ({batchResults.filter((r) => r.shortUrl).length} Created, {batchResults.filter((r) => r.error).length} Failed)
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-emerald-300 rounded px-2 py-1 gap-1.5 shadow-2xs">
                <Search className="w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  value={resultSearch}
                  onChange={(e) => {
                    setResultSearch(e.target.value);
                    resultsPagination.setCurrentPage(1);
                  }}
                  placeholder="Filter results..."
                  className="text-xs bg-transparent focus:outline-none w-28 sm:w-36 text-slate-700"
                />
              </div>

              <select
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value as any);
                  resultsPagination.setCurrentPage(1);
                }}
                className="text-xs px-2 py-1 rounded border border-emerald-300 bg-white text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All ({batchResults.length})</option>
                <option value="created">Created ({batchResults.filter((r) => r.shortUrl).length})</option>
                <option value="failed">Failed ({batchResults.filter((r) => r.error).length})</option>
              </select>

              <button
                onClick={handleExportResults}
                className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2 w-12 text-center">#</th>
                  <th className="px-3.5 py-2">Destination URL</th>
                  <th className="px-3.5 py-2">Generated Short URL</th>
                  <th className="px-3.5 py-2 w-32 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {resultsPagination.paginatedItems.map((resItem, i) => {
                  const globalIdx = (resultsPagination.currentPage - 1) * resultsPagination.pageSize + i;
                  return (
                    <tr key={globalIdx} className="hover:bg-slate-50/80">
                      <td className="px-3.5 py-2 text-center font-mono text-slate-400 text-[11px]">{globalIdx + 1}</td>
                      <td className="px-3.5 py-2 truncate max-w-xs text-slate-600 font-mono text-[11px]">{resItem.destinationUrl}</td>
                      <td className="px-3.5 py-2 font-mono text-xs">
                        {resItem.shortUrl ? (
                          <a href={resItem.shortUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold flex items-center gap-1">
                            <span>{resItem.shortUrl}</span>
                            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredResults.length > 25 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <Pagination
                currentPage={resultsPagination.currentPage}
                totalItems={resultsPagination.totalItems}
                pageSize={resultsPagination.pageSize}
                onPageChange={resultsPagination.setCurrentPage}
                onPageSizeChange={resultsPagination.setPageSize}
                itemLabel="created links"
              />
            </div>
          )}
        </div>
      )}

      {/* Quick Test Generator Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Zap className="w-4 h-4 fill-amber-500/20" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Auto-Generate Test Batch</h3>
                  <p className="text-[11px] text-slate-500">Benchmark speed with 100, 500 or 1,000 links</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
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
                    onClick={() => setCustomCount(preset.count)}
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
                <label className="font-semibold text-slate-700 block mb-1">Campaign Tag:</label>
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
                <Zap className="w-3.5 h-3.5 fill-current" />
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

      {/* Paste Raw URLs Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Paste Multiple URLs</h3>
                  <p className="text-[11px] text-slate-500">Paste raw lines of URLs or CSV text directly</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Paste URLs (One URL per line or comma-separated CSV):
              </label>
              <textarea
                rows={10}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3,my-alias,Marketing,INV-001"}
                className="w-full p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs text-slate-800 placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-400">
                Protocols (http/https) will be automatically formatted if omitted.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pastedText.trim()}
                onClick={handleProcessPastedUrls}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Import to Grid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
