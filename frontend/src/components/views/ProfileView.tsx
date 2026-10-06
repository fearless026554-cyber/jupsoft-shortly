'use client';

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  Calendar,
  Layers,
  Fingerprint,
  ArrowRight,
  ShieldAlert,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { api, TenantItem } from '../../api';
import {
  UserRole,
  ROLE_DEFINITIONS,
  ROLE_HIERARCHY,
  ALL_ENTITLEMENTS,
  getRoleDefinition,
  getRolePermissions,
  isRootSuperAdmin,
} from '../../utils/rbac';

interface ProfileViewProps {
  currentUser: any;
  tenants: TenantItem[];
  onUserUpdated?: () => void;
  onNavigate?: (tab: any) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  tenants,
  onUserUpdated,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'entitlements'>('profile');

  // Profile Form State
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.name || '');
      setAvatarUrl(currentUser.avatar_url || '');
    }
  }, [currentUser]);

  const userRole: UserRole = (currentUser?.role as UserRole) || 'user';
  const roleDef = getRoleDefinition(userRole);
  const roleLevel = ROLE_HIERARCHY[userRole] || 40;
  const isRoot = isRootSuperAdmin(currentUser || {});
  const userPermissions = getRolePermissions(userRole);

  const tenant = tenants.find((t) => t.id === currentUser?.tenant_id) || {
    name: currentUser?.tenant_name || 'System Root',
    code: currentUser?.tenant_code || 'MASTER',
  };

  // Profile Update Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setProfileMessage({ type: 'error', text: 'Display name must be at least 2 characters.' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await api.updateProfile({
        name: trimmedName,
        avatar_url: avatarUrl.trim() || null,
      });

      if (res.success) {
        setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
        if (onUserUpdated) onUserUpdated();
      } else {
        setProfileMessage({
          type: 'error',
          text: res.error?.message || 'Failed to update profile.',
        });
      }
    } catch (err: any) {
      setProfileMessage({
        type: 'error',
        text: err?.message || 'Network error updating profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.changePassword({ currentPassword, newPassword });
      if (res.success) {
        setPasswordMessage({
          type: 'success',
          text: 'Password updated successfully! Future logins will require this new password.',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({
          type: 'error',
          text: res.error?.message || 'Failed to change password. Please verify current password.',
        });
      }
    } catch (err: any) {
      setPasswordMessage({
        type: 'error',
        text: err?.message || 'Network error updating password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Password Strength Calculator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const pwdStrength = getPasswordStrength(newPassword);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50/50 dark:bg-[#090d16]">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <UserIcon className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span>My Account &amp; Profile</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Personal identity, authenticated credentials, session status, and active RBAC entitlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Level {roleLevel} • {roleDef.scope}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Identity & Security Card (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />

            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {currentUser?.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser?.name || 'User'}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-md ring-2 ring-slate-100 dark:ring-slate-700"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
                    {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 z-10"
                  title="Account Status: Active"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.name || 'Operator'}
                  </h2>
                  {isRoot && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                      MASTER
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {currentUser?.email || 'admin@jupsoft.com'}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <span>{roleDef.title}</span>
                </div>
              </div>
            </div>

            {/* Quick Metadata Chips */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Account Status</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active &amp; Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Assigned Workspace</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                  {tenant.name} ({tenant.code})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">System Scopes</span>
                <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                  {userPermissions.length} Scopes Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">User ID</span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                  {currentUser?.id || '—'}
                </span>
              </div>
            </div>

            {/* Navigation Tab Switcher */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'profile'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Personal Details</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'security'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Security &amp; Password</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('entitlements')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'entitlements'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Active Entitlements ({userPermissions.length})</span>
              </button>
            </div>
          </div>

          {/* Quick RBAC Hierarchy Snippet */}
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <Shield className="w-4 h-4 text-blue-500" />
              <span>Role Hierarchy Position</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Your role <strong className="text-slate-800 dark:text-slate-200">{roleDef.title}</strong> is ranked at tier level <span className="font-mono font-bold text-blue-600">{roleLevel}</span>.
              Operations requiring higher clearance are restricted by multi-tenant RBAC policies.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('users')}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold text-xs pt-1"
              >
                <span>View Full Team Matrix</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Sub-View Panels (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* TAB 1: PERSONAL DETAILS */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-blue-600" />
                    <span>Personal Profile Details</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Update your display name and profile presentation across the platform.
                  </p>
                </div>
              </div>

              {profileMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                    profileMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200'
                  }`}
                >
                  {profileMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Sachin Sharma"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Email Address (Identity Anchor)
                    </label>
                    <input
                      type="email"
                      value={currentUser?.email || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Assigned Role
                    </label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-slate-700 dark:text-slate-300 select-none">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-semibold">{roleDef.title}</span>
                      <span className="ml-auto text-[10px] text-slate-400 font-mono">Rank {roleLevel}</span>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Tenant Workspace
                    </label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-slate-700 dark:text-slate-300 select-none">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-semibold">{tenant.name}</span>
                      <span className="ml-auto text-[10px] text-slate-400 font-mono">Code: {tenant.code}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Profile Avatar URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Provide an HTTPS URL to a public image for your user icon.
                  </p>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingProfile ? 'Saving...' : 'Save Profile Details'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span>Change Account Password</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Update your account password. Password is encrypted with bcrypt (cost factor 10).
                  </p>
                </div>
              </div>

              {passwordMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                    passwordMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200'
                  }`}
                >
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-3.5 pr-10 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-3.5 pr-10 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1 h-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-full transition-colors ${
                                pwdStrength >= i
                                  ? pwdStrength >= 3
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                  : 'bg-slate-200 dark:bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {pwdStrength >= 3
                            ? 'Strong password'
                            : pwdStrength >= 2
                            ? 'Moderate password'
                            : 'Weak password (use 8+ chars with uppercase & numbers)'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <span className="text-[10px] text-red-500 block mt-1">Passwords do not match</span>
                    )}
                  </div>
                </div>

                {/* Password Policy Guidelines */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-500">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <span>Security Standards</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                    <li>Must be at least 6 characters long (8+ characters recommended).</li>
                    <li>Updating your password keeps existing API keys active but terminates invalid sessions.</li>
                    <li>Passwords are never stored in plaintext or transmitted insecurely.</li>
                  </ul>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isChangingPassword || (confirmPassword !== '' && newPassword !== confirmPassword)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5" />
                    )}
                    <span>{isChangingPassword ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: ACTIVE ENTITLEMENTS */}
          {activeTab === 'entitlements' && (
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Active System Entitlements Matrix</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Detailed list of all 28 RBAC permissions available on the platform and your clearance status.
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                  {userPermissions.length} / {ALL_ENTITLEMENTS.length} Granted
                </span>
              </div>

              {/* Entitlements Categorized Grid */}
              <div className="space-y-4">
                {(Array.from(new Set(ALL_ENTITLEMENTS.map((e) => e.category))) as string[]).map((category: string) => {
                  const categoryEntitlements = ALL_ENTITLEMENTS.filter((e) => e.category === category);
                  return (
                    <div
                      key={category}
                      className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden"
                    >
                      <div className="bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{category}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {categoryEntitlements.filter((e) => e.allowedRoles.includes(userRole)).length} of{' '}
                          {categoryEntitlements.length} enabled
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {categoryEntitlements.map((item) => {
                          const isAllowed = item.allowedRoles.includes(userRole);
                          return (
                            <div
                              key={item.id}
                              className={`p-3 flex items-start justify-between gap-3 ${
                                isAllowed
                                  ? 'bg-white dark:bg-[#0f172a]'
                                  : 'bg-slate-50/50 dark:bg-slate-900/20 opacity-60'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {item.label}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    {item.id}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  {item.description}
                                </p>
                              </div>

                              <div className="shrink-0 pt-0.5">
                                {isAllowed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <Check className="w-3 h-3" /> Enabled
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    <Lock className="w-2.5 h-2.5" /> Restricted
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
