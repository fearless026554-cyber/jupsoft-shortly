'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  RefreshCw,
  Mail,
  KeyRound,
  Trash2,
  Edit3,
  Crown,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  Sparkles,
  Share2,
  Lock,
  Building2,
  Briefcase,
  AlertTriangle,
  AlertCircle,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { UserItem, api, exportToCsv } from '../../api';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import {
  UserRole,
  ALL_ROLES,
  PERMISSIONS_MATRIX,
  ROLE_DEFINITIONS,
  getRoleConfig,
  getRoleDisplayName,
  getRoleLevel,
  canManageTargetUser,
  canDeleteTargetUser,
  getAllowedInviteRoles,
  isRootSuperAdminAccount,
  generateStrongPassword,
} from '../../utils/rbac';

interface UsersViewProps {
  onOpenInviteModal: () => void;
  currentUser?: any;
}

export const UsersView: React.FC<UsersViewProps> = ({ onOpenInviteModal, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'hierarchy' | 'matrix'>('directory');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [editRoleTarget, setEditRoleTarget] = useState<UserItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [editRoleLoading, setEditRoleLoading] = useState(false);
  const [editRoleError, setEditRoleError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const [shareCredentials, setShareCredentials] = useState<{
    user: UserItem;
    password: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const pagination = usePagination(filteredUsers, 10);

  // Export CSV
  const handleExport = () => {
    exportToCsv(
      `shortly_team_rbac_${new Date().toISOString().slice(0, 10)}`,
      filteredUsers.map((u) => ({
        Name: u.name,
        Email: u.email,
        Role: getRoleDisplayName(u.role),
        HierarchyLevel: getRoleLevel(u.role),
        Status: u.status,
        LastLogin: u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never',
        Joined: new Date(u.created_at).toLocaleDateString(),
      }))
    );
  };

  // Password Reset
  const handleOpenResetModal = (user: UserItem) => {
    setResetTarget(user);
    setNewPassword(generateStrongPassword());
    setShowPassword(true);
    setResetError(null);
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (newPassword.trim().length < 8) {
      setResetError('Password must be at least 8 characters long.');
      return;
    }
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await api.resetUserPassword(resetTarget.id, newPassword);
      if (res.success) {
        setShareCredentials({ user: resetTarget, password: newPassword });
        setResetTarget(null);
      } else {
        setResetError(res.error?.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setResetError(err.message || 'Network error');
    } finally {
      setResetLoading(false);
    }
  };

  // Edit Role
  const handleOpenEditRoleModal = (user: UserItem) => {
    setEditRoleTarget(user);
    setSelectedRole(user.role);
    setEditRoleError(null);
  };

  const handleExecuteEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoleTarget) return;
    setEditRoleLoading(true);
    setEditRoleError(null);

    try {
      const res = await api.updateUser(editRoleTarget.id, { role: selectedRole });
      if (res.success) {
        setSuccessNotification(`Operational tier for ${editRoleTarget.name} updated to ${getRoleDisplayName(selectedRole)} successfully.`);
        setTimeout(() => setSuccessNotification(null), 4000);
        setEditRoleTarget(null);
        loadUsers();
      } else {
        setEditRoleError(res.error?.message || 'Failed to update user role');
      }
    } catch (err: any) {
      setEditRoleError(err.message || 'Network error');
    } finally {
      setEditRoleLoading(false);
    }
  };

  // Toggle Status (Suspend / Activate)
  const handleToggleStatus = async (user: UserItem) => {
    const isTargetRoot = isRootSuperAdminAccount(user);
    if (!canManageTargetUser(currentUser?.role, user.role, isTargetRoot)) return;

    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await api.updateUser(user.id, { status: newStatus });
      if (res.success) {
        loadUsers();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Delete User
  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await api.deleteUser(deleteTarget.id);
      if (res.success) {
        setDeleteTarget(null);
        loadUsers();
      } else {
        setDeleteError(res.error?.message || 'Failed to delete user');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Network error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Copy Credentials card
  const handleCopyCredentials = () => {
    if (!shareCredentials) return;
    const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://shortly.jupsoft.com/login';
    const text = `Jupsoft Shortly — Access Credentials\nPortal URL: ${portalUrl}\nEmail: ${shareCredentials.user.email}\nTemporary Password: ${shareCredentials.password}\nRole: ${getRoleDisplayName(shareCredentials.user.role)}\n\nPlease sign in and update your password upon initial login.`;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Render Avatar
  const renderAvatar = (name: string, role: string, size = 'w-9 h-9 text-xs') => {
    const initial = (name?.trim()?.charAt(0) || 'U').toUpperCase();
    const config = getRoleConfig(role);
    return (
      <div
        className={`${size} rounded-full ${config.colorClasses.badgeBg} ${config.colorClasses.badgeText} flex items-center justify-center font-bold border ${config.colorClasses.badgeBorder} shrink-0 select-none shadow-2xs`}
      >
        {initial}
      </div>
    );
  };

  // Group permissions by category for the matrix
  const permissionsByCategory = useMemo(() => {
    const map = new Map<string, typeof PERMISSIONS_MATRIX>();
    for (const p of PERMISSIONS_MATRIX) {
      if (!map.has(p.category)) {
        map.set(p.category, []);
      }
      map.get(p.category)!.push(p);
    }
    return Array.from(map.entries());
  }, []);

  const allowedInviteRoles = getAllowedInviteRoles(currentUser?.role);
  const canInvite = allowedInviteRoles.length > 0;

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {successNotification && (
        <div className="fixed top-14 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-2 duration-200 border border-emerald-500">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOP HEADER & ACTION BAR                                               */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Team &amp; Access Control (RBAC)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hierarchical role delegations, multi-tenant governance &amp; fine-grained entitlement matrices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadUsers}
            title="Refresh user directory"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {canInvite && (
            <button
              onClick={onOpenInviteModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABS NAVIGATION                                                       */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Operator Directory</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'hierarchy'
              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>Role Hierarchy</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            5 Tiers
          </span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Entitlements Matrix</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {PERMISSIONS_MATRIX.length} Scopes
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OPERATOR DIRECTORY                                             */}
      {/* ===================================================================== */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role & Status Selectors */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Roles ({users.length})</option>
                <option value="super_admin">Super Admins</option>
                <option value="tenant_admin">Tenant Admins</option>
                <option value="manager">Operations Managers</option>
                <option value="user">Staff Operators</option>
                <option value="read_only">Auditors</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="invited">Invited / Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-6">
                <TableSkeleton rows={6} columns={5} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">No operators found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  No team members matched the current search and role filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4 font-semibold">Operator / Account</th>
                      <th className="py-3 px-4 font-semibold">Assigned Role &amp; Tier</th>
                      <th className="py-3 px-4 font-semibold">Account Status</th>
                      <th className="py-3 px-4 font-semibold">Last Active</th>
                      <th className="py-3 px-4 font-semibold">Created</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {pagination.paginatedItems.map((user) => {
                      const isRoot = isRootSuperAdminAccount(user);
                      const isSelf = currentUser?.id === user.id || currentUser?.userId === user.id;
                      const roleCfg = getRoleConfig(user.role);
                      const canManage = canManageTargetUser(currentUser?.role, user.role, isRoot, isSelf);
                      const canDelete = canDeleteTargetUser(currentUser?.role, user.role, isRoot, isSelf);

                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                        >
                          {/* User / Email */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {renderAvatar(user.name, user.role)}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                                  <span>{user.name}</span>
                                  {isRoot && (
                                    <span title="Root Master Super Administrator">
                                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    </span>
                                  )}
                                  {isSelf && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleCfg.colorClasses.badgeBg} ${roleCfg.colorClasses.badgeText} ${roleCfg.colorClasses.badgeBorder}`}
                              >
                                {user.role === 'super_admin' && <Crown className="w-3 h-3 text-purple-600" />}
                                {user.role === 'tenant_admin' && <Shield className="w-3 h-3 text-blue-600" />}
                                {user.role === 'manager' && <Briefcase className="w-3 h-3 text-emerald-600" />}
                                {user.role === 'user' && <Users className="w-3 h-3 text-slate-600" />}
                                {user.role === 'read_only' && <Eye className="w-3 h-3 text-amber-600" />}
                                <span>{roleCfg.title}</span>
                              </span>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                Level {roleCfg.level} • {roleCfg.scope}
                              </div>
                            </div>
                          </td>

                          {/* Status Pill */}
                          <td className="py-3.5 px-4">
                            {user.status === 'active' && (
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={!canManage}
                                title={canManage ? 'Click to suspend' : 'Active status'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 ${
                                  canManage ? 'hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer' : 'cursor-default'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active</span>
                              </button>
                            )}
                            {user.status === 'invited' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3 h-3" />
                                <span>Invited</span>
                              </span>
                            )}
                            {user.status === 'suspended' && (
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={!canManage}
                                title={canManage ? 'Click to reactivate' : 'Suspended'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 ${
                                  canManage ? 'hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer' : 'cursor-default'
                                }`}
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Suspended</span>
                              </button>
                            )}
                          </td>

                          {/* Last Login */}
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {user.last_login_at
                              ? new Date(user.last_login_at).toLocaleString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Never'}
                          </td>

                          {/* Created */}
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit Role Button */}
                              {canManage && (
                                <button
                                  onClick={() => handleOpenEditRoleModal(user)}
                                  title="Change role"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Reset Password Button */}
                              {canManage && (
                                <button
                                  onClick={() => handleOpenResetModal(user)}
                                  title="Reset credentials"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition cursor-pointer"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete Button */}
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteTarget(user)}
                                  title="Remove operator"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}

                              {!canManage && !canDelete && (
                                isRoot ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md select-none" title="Root Master account is permanently protected">
                                    <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span>Root Master</span>
                                  </span>
                                ) : isSelf ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md select-none" title="You cannot modify your own role">
                                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>Protected (You)</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                                    Protected
                                  </span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {filteredUsers.length > 10 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <Pagination
                  currentPage={pagination.currentPage}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  onPageChange={pagination.setCurrentPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ROLE HIERARCHY TREE                                            */}
      {/* ===================================================================== */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-purple-500" />
              <span>Hierarchical Authority Model</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Shortly enforces strict rank-based privilege segregation. An actor can only manage, invite, or reset credentials for operators strictly below their hierarchical level.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_ROLES.map((role) => {
              const def = ROLE_DEFINITIONS[role];
              const assignedUsers = users.filter((u) => u.role === role);

              return (
                <div
                  key={role}
                  className={`bg-white dark:bg-[#0f172a] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700 ${def.colorClasses.border}`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${def.colorClasses.badgeBg} ${def.colorClasses.badgeText} ${def.colorClasses.badgeBorder}`}
                      >
                        Level {def.level} • {def.scope}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {assignedUsers.length} {assignedUsers.length === 1 ? 'Member' : 'Members'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{def.title}</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {def.description}
                      </p>
                    </div>

                    {/* Key Responsibilities */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Core Entitlements:
                      </div>
                      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {def.responsibilities.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-[11px] leading-snug">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Assigned Members Mini Pile */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {assignedUsers.slice(0, 5).map((u) => (
                          <div key={u.id} title={`${u.name} (${u.email})`}>
                            {renderAvatar(u.name, u.role, 'w-6 h-6 text-[9px]')}
                          </div>
                        ))}
                        {assignedUsers.length > 5 && (
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[9px] border border-white dark:border-slate-800">
                            +{assignedUsers.length - 5}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setRoleFilter(role);
                          setActiveTab('directory');
                        }}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        View Directory →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PERMISSIONS & ENTITLEMENTS MATRIX                              */}
      {/* ===================================================================== */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs space-y-4">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-500" />
                <span>Composable RBAC Entitlement Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exact mapping of system scopes (<code className="text-indigo-500 font-mono">resource.action</code>) across all 5 operational roles.
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Audit-Ready
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold min-w-[240px]">Permission Scope</th>
                  {ALL_ROLES.map((r) => {
                    const cfg = getRoleConfig(r);
                    return (
                      <th key={r} className="py-3 px-3 font-semibold text-center whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{cfg.badge}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Lvl {cfg.level}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {permissionsByCategory.map(([category, items]) => (
                  <React.Fragment key={category}>
                    {/* Category Header Row */}
                    <tr className="bg-slate-100/60 dark:bg-slate-900/80 font-bold text-slate-800 dark:text-slate-200">
                      <td colSpan={6} className="py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                        <span>{category}</span>
                      </td>
                    </tr>

                    {/* Permission Items */}
                    {items.map((perm) => (
                      <tr key={perm.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{perm.label}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                            {perm.description}
                          </div>
                          <div className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 mt-0.5">
                            {perm.id}
                          </div>
                        </td>

                        {ALL_ROLES.map((r) => {
                          const isAllowed = perm.allowedRoles.includes(r);
                          return (
                            <td key={r} className="py-3 px-3 text-center">
                              {isAllowed ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-300 dark:text-slate-600">
                                  <X className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: RESET PASSWORD                                               */}
      {/* ===================================================================== */}
      {resetTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Reset Credentials</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Issue temporary login access for {resetTarget.name}</p>
                </div>
              </div>

              <button
                onClick={() => setResetTarget(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteReset} className="p-6 text-xs space-y-4">
              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-xs">
                  {resetError}
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                {renderAvatar(resetTarget.name, resetTarget.role, 'w-8 h-8 text-xs')}
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{resetTarget.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{resetTarget.email}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">New Temporary Password *</label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateStrongPassword())}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {resetLoading ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: EDIT ROLE                                                    */}
      {/* ===================================================================== */}
      {editRoleTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderAvatar(editRoleTarget.name, editRoleTarget.role, 'w-10 h-10 text-sm')}
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Modify Operational Tier</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      {editRoleTarget.name}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]">
                      {editRoleTarget.email}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setEditRoleTarget(null)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteEditRole} className="p-6 text-xs space-y-4 max-h-[82vh] overflow-y-auto">
              {editRoleError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{editRoleError}</span>
                </div>
              )}

              {/* Current Role Banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <span className="text-slate-500 text-[11px] font-medium">Current Operational Tier:</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getRoleConfig(editRoleTarget.role).colorClasses.badgeBg} ${getRoleConfig(editRoleTarget.role).colorClasses.badgeText} ${getRoleConfig(editRoleTarget.role).colorClasses.badgeBorder}`}>
                  <span>{getRoleDisplayName(editRoleTarget.role)}</span>
                  <span className="text-[10px] font-mono">Level {getRoleLevel(editRoleTarget.role)}</span>
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Select New Operational Tier
                </label>
                <div className="space-y-2">
                  {allowedInviteRoles.map((r) => {
                    const cfg = getRoleConfig(r);
                    const isSelected = selectedRole === r;
                    const isCurrent = editRoleTarget.role === r;

                    return (
                      <div
                        key={r}
                        onClick={() => setSelectedRole(r)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Role Icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${cfg.colorClasses.badgeBg} ${cfg.colorClasses.badgeText} ${cfg.colorClasses.badgeBorder}`}>
                              {r === 'super_admin' && <Crown className="w-4 h-4 text-purple-600" />}
                              {r === 'tenant_admin' && <Shield className="w-4 h-4 text-blue-600" />}
                              {r === 'manager' && <Briefcase className="w-4 h-4 text-emerald-600" />}
                              {r === 'user' && <Users className="w-4 h-4 text-slate-600" />}
                              {r === 'read_only' && <Eye className="w-4 h-4 text-amber-600" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {cfg.title}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${cfg.colorClasses.badgeBg} ${cfg.colorClasses.badgeText} ${cfg.colorClasses.badgeBorder}`}>
                                  Level {cfg.level}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                  {cfg.scope}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                {cfg.description}
                              </p>
                            </div>
                          </div>

                          {/* Radio Circle */}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Change Impact Preview */}
              {selectedRole !== editRoleTarget.role && (
                <div className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2.5 ${
                  getRoleLevel(selectedRole) > getRoleLevel(editRoleTarget.role)
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                    : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}>
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {getRoleLevel(selectedRole) > getRoleLevel(editRoleTarget.role)
                        ? 'Operational Promotion'
                        : 'Operational Demotion'}
                      :
                    </span>{' '}
                    Changing from <strong className="font-semibold">{getRoleDisplayName(editRoleTarget.role)}</strong> to{' '}
                    <strong className="font-semibold">{getRoleDisplayName(selectedRole)}</strong> will take effect immediately. All active sessions and permission gates will sync within 60 seconds.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditRoleTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editRoleLoading || selectedRole === editRoleTarget.role}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  {editRoleLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Role...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Role</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: SHARE CREDENTIALS CARD                                       */}
      {/* ===================================================================== */}
      {shareCredentials && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Credentials Ready to Share</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Send this login information to the operator.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Target Account</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{shareCredentials.user.name} ({shareCredentials.user.email})</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Assigned Role</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{getRoleDisplayName(shareCredentials.user.role)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Temporary Password</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 inline-block">
                  {shareCredentials.password}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleCopyCredentials}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
              </button>

              <button
                onClick={() => setShareCredentials(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: DELETE CONFIRMATION                                          */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Operator Account</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong> (<span className="font-mono text-slate-500">{deleteTarget.email}</span>)?
              They will immediately lose all access to this organization and routing services.
            </p>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleExecuteDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
