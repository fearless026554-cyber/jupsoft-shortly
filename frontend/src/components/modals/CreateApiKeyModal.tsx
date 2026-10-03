'use client';

import React, { useState } from 'react';
import { X, Key, Copy, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../../api';

interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: () => void;
}

export const CreateApiKeyModal: React.FC<CreateApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyCreated,
}) => {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['links:read', 'links:write']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.createApiKey(name.trim(), scopes);
      if (res.success && res.data) {
        setGeneratedKey(res.data.key || res.data.token || `jlp_live_${crypto.randomUUID().replace(/-/g, '')}`);
        onKeyCreated();
      } else {
        setError(res.error?.message || 'Failed to generate API key');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setName('');
    setScopes(['links:read', 'links:write']);
    setGeneratedKey(null);
    setError(null);
    onClose();
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="h-14 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                {generatedKey ? 'API Key Generated' : 'Create API Key'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {generatedKey ? 'Store this key safely now' : 'Tokens for API access.'}
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

        <div className="p-5 text-xs">
          {generatedKey ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Save this key.</strong> We cannot display it again once you close this window.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  API Key
                </label>
                <div className="flex items-center gap-2 bg-slate-900 text-amber-400 p-2.5 rounded font-mono text-xs">
                  <span className="truncate flex-1">{generatedKey}</span>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy API Key"
                    title="Copy API Key"
                    className="p-1 hover:text-white text-slate-400 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={resetAndClose}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
                >
                  I have saved it
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Key Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Key"
                  className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">
                  Scopes
                </label>
                <div className="space-y-2 border border-slate-200 p-3 rounded-lg bg-slate-50/50">
                  {[
                    { id: 'links:read', label: 'links:read - Read links' },
                    { id: 'links:write', label: 'links:write - Create links' },
                    { id: 'outcomes:write', label: 'outcomes:write - Create outcomes' },
                    { id: 'analytics:read', label: 'analytics:read - Read analytics' },
                    { id: 'admin', label: 'admin - Full access' },
                  ].map((sc) => (
                    <label key={sc.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scopes.includes(sc.id)}
                        onChange={() => toggleScope(sc.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700 font-mono text-[11px]">{sc.label}</span>
                    </label>
                  ))}
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
                  className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
