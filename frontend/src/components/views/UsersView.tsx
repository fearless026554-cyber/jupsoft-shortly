'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  Mail,
  Key,
} from 'lucide-react';
import { UserItem, api, exportToCsv } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';

interface UsersViewProps {
  onOpenInviteModal: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ onOpenInviteModal }) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [resetState, setResetState] = useState<{ [id: string]: boolean }>({});

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const pagination = usePagination(filtered, 10);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold text-[10px] uppercase">
            Super Admin
          </span>
        );
      case 'tenant_admin':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[10px] uppercase">
            School Principal
          </span>
        );
      case 'manager':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] uppercase">
            Accounts & Fees
          </span>
        );
      case 'user':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase">
            Staff Operator
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase">
            {role}
          </span>
        );
    }
  };

  const handleExport = () => {
    exportToCsv(
      `users_rbac_${new Date().toISOString().slice(0, 10)}`,
      users.map((u) => ({
        Name: u.name,
        Email: u.email,
        Role: u.role,
        Status: u.status,
        LastLogin: u.last_login_at || 'Never',
      }))
    );
  };

  const handleReset = (user: UserItem) => {
    setResetState(prev => ({ ...prev, [user.id]: true }));
    setTimeout(() => {
      setResetState(prev => ({ ...prev, [user.id]: false }));
    }, 3000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Users
              <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded-full font-semibold">
                Roles
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage your users and their roles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Export
          </button>
          <button
            onClick={onOpenInviteModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E42527] hover:bg-[#c91e20] text-white text-xs font-bold shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user by name or email..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="tenant_admin">School Principal</option>
            <option value="manager">Accounts & Fees</option>
            <option value="user">Staff Operator</option>
          </select>
        </div>

        <button
          onClick={loadUsers}
          aria-label="Refresh Staff Members"
          title="Refresh Staff Members"
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-100 rounded w-44" />
                  </div>
                </div>
                <div className="h-5 bg-slate-100 rounded w-24" />
                <div className="h-5 bg-slate-100 rounded w-16" />
                <div className="h-6 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
              <Users className="w-7 h-7 text-slate-400" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-bold text-slate-800">
                No Users Found
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {search || roleFilter !== 'all'
                  ? 'No user profiles match your filters. Try adjusting them.'
                  : 'Invite users to start managing short links.'}
              </p>
            </div>
            {!search && roleFilter === 'all' && (
              <button
                onClick={onOpenInviteModal}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E42527] hover:bg-[#c91e20] text-white text-xs font-bold shadow-xs transition"
              >
                <UserPlus className="w-4 h-4" />
                Invite User
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">User</th>
                  <th className="px-3.5 py-2.5">Role</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Last Login</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {pagination.isLazyLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3.5 py-6">
                      <TableSkeleton rows={pagination.pageSize} columns={5} />
                    </td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((user) => {
                  const initials = user.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{user.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3.5 py-3">
                        {getRoleBadge(user.role)}
                      </td>

                      <td className="px-3.5 py-3">
                        {user.status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Pending Invite
                          </span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-slate-500 font-mono text-[11px]">
                        {user.last_login_at || 'Invited'}
                      </td>

                      <td className="px-3.5 py-3 text-right">
                        <button
                          onClick={() => handleReset(user)}
                          disabled={resetState[user.id]}
                          className={`px-2.5 py-1 rounded-md font-semibold text-xs transition ${
                            resetState[user.id]
                              ? 'bg-emerald-100 text-emerald-800 cursor-default'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {resetState[user.id] ? 'Sent!' : 'Reset Password'}
                        </button>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>

            {filtered.length > 0 && (
              <Pagination
                currentPage={pagination.currentPage}
                totalItems={filtered.length}
                pageSize={pagination.pageSize}
                onPageChange={pagination.setCurrentPage}
                onPageSizeChange={pagination.setPageSize}
                itemLabel="users"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
