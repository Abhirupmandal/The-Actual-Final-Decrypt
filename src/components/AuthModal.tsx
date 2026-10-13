import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Key,
  X,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  ShieldCheck,
  LogIn,
  UserCheck,
} from 'lucide-react';
import { playCyberBlip, playSuccessChime, playErrorBuzz } from '../utils/audio.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (team: any, token: string) => void;
  onAdminSuccess?: (token: string, adminName?: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onAdminSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('signup');

  // Sign Up Form State
  const [signupTeamName, setSignupTeamName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [members, setMembers] = useState<string[]>(['', '']);

  // Login Form State
  const [loginTeamName, setLoginTeamName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Password strength calculator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: '', color: '', pct: 0 };
    if (pwd.length < 8) return { label: 'Too short (min 8)', color: 'bg-red-500', pct: 25 };
    const hasLetters = /[A-Za-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    if (hasLetters && hasNumbers && hasSpecial && pwd.length >= 10) {
      return { label: 'Strong', color: 'bg-[#00ff66]', pct: 100 };
    }
    if (hasLetters && hasNumbers) {
      return { label: 'Good', color: 'bg-amber-400', pct: 65 };
    }
    return { label: 'Weak (add numbers/symbols)', color: 'bg-orange-400', pct: 40 };
  };

  const strength = getPasswordStrength(signupPassword);

  const handleAddMember = () => {
    if (members.length < 3) {
      playCyberBlip(750);
      setMembers([...members, '']);
    }
  };

  const handleRemoveMember = (idx: number) => {
    if (members.length > 2) {
      playCyberBlip(600);
      setMembers(members.filter((_, i) => i !== idx));
    }
  };

  const handleMemberChange = (idx: number, val: string) => {
    const updated = [...members];
    updated[idx] = val;
    setMembers(updated);
  };

  // Handle Sign Up
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupTeamName.trim() || signupTeamName.trim().length < 3) {
      setError('Team name must contain at least 3 characters.');
      playErrorBuzz();
      return;
    }

    if (!signupEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      setError('A valid team email address is required (strictly 1 account per email to avoid cheating).');
      playErrorBuzz();
      return;
    }

    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      playErrorBuzz();
      return;
    }

    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(signupPassword)) {
      setError('Password must contain both letters and numbers.');
      playErrorBuzz();
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.');
      playErrorBuzz();
      return;
    }

    const validMembers = members.map((m) => m.trim()).filter((m) => m.length > 0);
    if (validMembers.length < 2) {
      setError('A team must have at least 2 members.');
      playErrorBuzz();
      return;
    }
    if (validMembers.length > 3) {
      setError('A team can have a maximum of 3 members.');
      playErrorBuzz();
      return;
    }

    setIsLoading(true);
    playCyberBlip(900);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: signupTeamName.trim(),
          email: signupEmail.trim().toLowerCase(),
          password: signupPassword,
          members: validMembers,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playSuccessChime();
        localStorage.setItem('ctf_team_token', data.token);
        onSuccess(data.team, data.token);
        onClose();
      } else {
        playErrorBuzz();
        setError(data.error || 'Failed to register team.');
      }
    } catch (e) {
      playErrorBuzz();
      setError('Network communication failure. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Log In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginTeamName.trim()) {
      setError('Please enter your team name.');
      playErrorBuzz();
      return;
    }

    if (!loginPassword) {
      setError('Please enter your team password.');
      playErrorBuzz();
      return;
    }

    setIsLoading(true);
    playCyberBlip(900);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: loginTeamName.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playSuccessChime();
        if (data.isAdmin) {
          if (onAdminSuccess) {
            onAdminSuccess(data.token, data.adminName);
          } else {
            window.location.reload();
          }
          onClose();
          return;
        }
        localStorage.setItem('ctf_team_token', data.token);
        onSuccess(data.team, data.token);
        onClose();
      } else {
        playErrorBuzz();
        setError(data.error || 'Invalid team credentials.');
      }
    } catch (e) {
      playErrorBuzz();
      setError('Authentication server unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#0d111a]/95 border border-[#00ff66]/60 shadow-[0_0_45px_rgba(0,255,102,0.25)] rounded-2xl p-6 sm:p-7 max-w-md w-full font-mono text-xs relative my-auto max-h-[90dvh] overflow-y-auto backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-80" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Toggle: Sign Up vs Login */}
        <div className="flex items-center gap-1 bg-[#080b12] p-1 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              playCyberBlip(700);
              setActiveTab('signup');
              setError(null);
            }}
            className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg font-bold text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-[#00ff66] text-black shadow-[0_0_12px_rgba(0,255,102,0.25)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>SIGN UP (NEW TEAM)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playCyberBlip(700);
              setActiveTab('login');
              setError(null);
            }}
            className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg font-bold text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-[#00ff66] text-black shadow-[0_0_12px_rgba(0,255,102,0.25)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>LOG IN</span>
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded mb-4 bg-red-500/15 border border-red-500/40 text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. SIGN UP FORM */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="text-slate-300 font-bold block mb-1">
                TEAM NAME <span className="text-[#00ff66]">*</span>
              </label>
              <input
                type="text"
                required
                value={signupTeamName}
                onChange={(e) => setSignupTeamName(e.target.value)}
                placeholder="e.g. ByteBreakers"
                className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded px-3 py-2 text-white outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Unique identifier across the tournament.
              </span>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">
                EMAIL ADDRESS <span className="text-[#00ff66]">*</span>
              </label>
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="e.g. teamlead@example.com"
                className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded px-3 py-2 text-white outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Official contact email. Strictly 1 team per email to ensure fair play.
              </span>
            </div>

            {/* Password input */}
            <div>
              <label className="text-slate-300 font-bold block mb-1">
                TEAM PASSWORD <span className="text-[#00ff66]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Min 8 characters (letters + numbers)"
                  className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded pl-3 pr-9 py-2 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Password strength meter */}
              {signupPassword && (
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${strength.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Strength: {strength.label}</span>
                    <span className="text-slate-500">PBKDF2 100k Salted</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-slate-300 font-bold block mb-1">
                CONFIRM PASSWORD <span className="text-[#00ff66]">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                placeholder="Re-enter team password"
                className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded px-3 py-2 text-white outline-none"
              />
            </div>

            {/* Team Members */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-bold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>MEMBERS ({members.length}/3 MAX)</span>
                </label>

                {members.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="text-[11px] text-[#00ff66] hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {members.map((member, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      required={idx < 2}
                      value={member}
                      onChange={(e) => handleMemberChange(idx, e.target.value)}
                      placeholder={idx === 0 ? 'Member 1 (Team Leader) *' : idx === 1 ? 'Member 2 (Required) *' : 'Member 3 (Optional)'}
                      className="flex-1 bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded px-3 py-1.5 text-white outline-none"
                    />
                    {members.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded bg-slate-900"
                        title="Remove Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[46px] py-3 bg-[#00ff66] hover:bg-[#00ff66]/85 text-black font-mono font-bold tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,102,0.4)] hover:shadow-[0_0_25px_rgba(0,255,102,0.7)] transition-all disabled:opacity-50 cursor-pointer active:scale-98"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{isLoading ? 'CREATING TEAM...' : 'REGISTER TEAM & JOIN'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. LOG IN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-slate-300 font-bold block mb-1">
                TEAM NAME OR EMAIL <span className="text-[#00ff66]">*</span>
              </label>
              <input
                type="text"
                required
                value={loginTeamName}
                onChange={(e) => setLoginTeamName(e.target.value)}
                placeholder="Enter team name or email"
                className="w-full min-h-[44px] bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl px-3 py-2.5 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">
                PASSWORD <span className="text-[#00ff66]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter team password"
                  className="w-full min-h-[44px] bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl pl-3 pr-10 py-2.5 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[46px] py-3 bg-[#00ff66] hover:bg-[#00ff66]/85 text-black font-mono font-bold tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,102,0.4)] hover:shadow-[0_0_25px_rgba(0,255,102,0.7)] transition-all disabled:opacity-50 cursor-pointer active:scale-98"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isLoading ? 'VERIFYING CREDENTIALS...' : 'SIGN IN TO TEAM'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Security badge footer */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure &amp; Encrypted Sign-In</span>
          </div>
          <span>Fair Play &amp; Abuse Protected</span>
        </div>
      </div>
    </div>
  );
};
