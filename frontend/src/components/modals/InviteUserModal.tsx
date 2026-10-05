'use client';

import React, { useState } from 'react';
import { X, UserPlus, Mail, Shield, CheckCircle2 } from 'lucide-react';
import { api } from '../../api';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserInvited: () => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  onUserInvited,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.inviteUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        password: password.trim() || undefined,
      });

      if (res.success) {
        setName('');
        setEmail('');
        setPassword('');
        onUserInvited();
        onClose();
      } else {
        setError(res.error?.message || 'Failed to create user');
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
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Add User</h3>
              <p className="text-[11px] text-slate-500">Create a user account with direct credentials.</p>
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
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Chandra"
              className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="r.chandra@hillwoods.edu.in"
              className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Initial Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full text-xs px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="tenant_admin">Admin (Full Access)</option>
              <option value="manager">Manager (Outcomes & Bulk)</option>
              <option value="user">User (Links & QRs)</option>
              <option value="read_only">Read-Only (Analytics)</option>
            </select>
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
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
