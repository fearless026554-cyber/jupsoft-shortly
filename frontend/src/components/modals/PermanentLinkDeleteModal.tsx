'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  Lock,
  ExternalLink,
  Archive,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { LinkItem } from '../../api';

interface PermanentLinkDeleteModalProps {
  isOpen: boolean;
  link: LinkItem | null;
  defaultDomain: string;
  onClose: () => void;
  onArchive: (id: string) => Promise<void>;
  onDeletePermanently?: (id: string) => Promise<void>;
}

export const PermanentLinkDeleteModal: React.FC<PermanentLinkDeleteModalProps> = ({
  isOpen,
  link,
  defaultDomain,
  onClose,
  onArchive,
  onDeletePermanently,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);
  const [actionLoading, setActionLoading] = useState<'archive' | 'delete' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setHasConfirmedCheckbox(false);
      setActionLoading(null);
    }
  }, [isOpen, link]);

  if (!isOpen || !link) return null;

  const expectedCode = (link.short_code || '').trim();
  const isMatch = confirmText.trim().toLowerCase() === expectedCode.toLowerCase();
  const canProceed = isMatch && hasConfirmedCheckbox && !actionLoading;

  const handleExecuteArchive = async () => {
    if (!canProceed) return;
    setActionLoading('archive');
    try {
      await onArchive(link.id);
      onClose();
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecuteDeletePermanent = async () => {
    if (!canProceed || !onDeletePermanently) return;
    setActionLoading('delete');
    try {
      await onDeletePermanently(link.id);
      onClose();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/60 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-red-50/80 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Permanent Protected Asset Deletion
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700">
                  Protected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Multi-step enterprise safety verification required.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Banner */}
          <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Critical Production Asset Protection</p>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/90">
                This link is designated as a <strong>Permanent Asset</strong> (such as a core school mobile app, portal, or system gateway). Deleting or archiving it will immediately sever live user traffic and break incoming mobile store redirects.
              </p>
            </div>
          </div>

          {/* Target Link Metadata Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Short URL
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                https://{defaultDomain}/{link.short_code}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase shrink-0">
                Target Destination
              </span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate text-right">
                {link.destination_url}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Total Live Clicks
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {(link.click_count || 0).toLocaleString()} clicks
              </span>
            </div>
          </div>

          {/* Verification Step 1: Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition select-none">
            <input
              type="checkbox"
              checked={hasConfirmedCheckbox}
              onChange={(e) => setHasConfirmedCheckbox(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-red-600 border-slate-300 dark:border-slate-600 focus:ring-red-500 cursor-pointer"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              I acknowledge that I am an authorized Administrator and confirm that incoming traffic for this permanent link should be halted.
            </span>
          </label>

          {/* Verification Step 2: Type short code */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Type the short code <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 font-mono font-bold">{expectedCode}</code> to unlock deletion:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type "${expectedCode}"`}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canProceed}
              onClick={handleExecuteArchive}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              title="Deactivates the link and moves it to Archive (Can be restored later)"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{actionLoading === 'archive' ? 'Archiving...' : 'Archive (Restorable)'}</span>
            </button>

            {onDeletePermanently && (
              <button
                type="button"
                disabled={!canProceed}
                onClick={handleExecuteDeletePermanent}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                title="Permanently drops the record from the database"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoading === 'delete' ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
