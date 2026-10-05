'use client';

import React, { useState } from 'react';
import { X, Building2, Plus, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../../api';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTenantCreated: () => void;
}

export const CreateTenantModal: React.FC<CreateTenantModalProps> = ({
  isOpen,
  onClose,
  onTenantCreated,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState('internal_unlimited');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.createTenant({
        code: code.trim().toLowerCase(),
        name: name.trim(),
        planId,
      });

      if (res.success) {
        onTenantCreated();
        onClose();
      } else {
        setError(res.error?.message || 'Failed to add tenant');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="h-14 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Add Tenant</h3>
              <p className="text-[11px] text-slate-500">Create a new tenant workspace.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 text-xs space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Tenant Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tenant Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                placeholder="e.g. acme"
                className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Lowercase letters only
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Plan
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="internal_unlimited">Internal Unlimited</option>
                <option value="standard">Standard</option>
                <option value="enterprise_multi_branch">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
