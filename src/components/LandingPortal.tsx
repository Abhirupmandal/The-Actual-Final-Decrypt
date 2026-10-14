import React, { useState } from 'react';
import {
  Shield,
  Key,
  Users,
  UserPlus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  LogIn,
  AlertCircle,
  Terminal,
  Trophy,
  Activity,
  Flame,
  CheckCircle,
  Zap,
  Mail,
} from 'lucide-react';
import { playCyberBlip, playSuccessChime, playErrorBuzz } from '../utils/audio.ts';

interface LandingPortalProps {
  onSuccess: (team: any, token: string) => void;
  onAdminSuccess?: (token: string, adminName?: string) => void;
  onExploreScoreboard: () => void;
}

export const LandingPortal: React.FC<LandingPortalProps> = ({
  onSuccess,
  onAdminSuccess,
  onExploreScoreboard,
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

  // Password strength calculator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: '', color: '', pct: 0 };
    if (pwd.length < 8) return { label: 'Too short (min 8)', color: 'bg-red-500', pct: 25 };
    const hasLetters = /[A-Za-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    if (hasLetters && hasNumbers && hasSpecial && pwd.length >= 10) {
      return { label: 'Strong (Argon2id Memory-Hard)', color: 'bg-[#00ff66]', pct: 100 };
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

  // Sign Up Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupTeamName.trim() || signupTeamName.trim().length < 3) {
      setError('Team name must contain at least 3 characters.');
      playErrorBuzz();
      return;
    }

    if (!signupEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      setError('A valid operator/team email address is required.');
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

  // Login Submit
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
          return;
        }
        localStorage.setItem('ctf_team_token', data.token);
        onSuccess(data.team, data.token);
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
    <div className="min-h-[80vh] flex items-center justify-center py-6 sm:py-10 animate-fadeIn font-mono">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Cyberpunk Hero Banner & Intelligence Briefing */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/40 text-[#00ff66] text-xs font-bold shadow-[0_0_15px_rgba(0,255,102,0.2)]">
            <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-ping" />
            <span>COMPETITION REGISTRATION &amp; SIGN IN</span>
          </div>

          <div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              <span className="text-[#00ff66] animate-neon-pulse">&gt; THE FINAL DECRYPT</span>
              <span className="block text-2xl sm:text-3xl text-[#00f0ff] mt-1 font-extrabold">
                ROUND 2: NO CLUE, NO MERCY
              </span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 font-sans leading-relaxed">
              Welcome to The Final Decrypt competition. Compete across cryptography, web security,
              digital forensics, reverse engineering, and problem solving with live scoring and fair play protection.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#0d111a]/90 border border-slate-800">
              <div className="text-[#00ff66] font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>Secure Accounts</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Encrypted and protected team authentication.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0d111a]/90 border border-slate-800">
              <div className="text-[#00f0ff] font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>2-3 Team Members</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Collaborate in squads of 2 to 3 members.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0d111a]/90 border border-slate-800">
              <div className="text-amber-400 font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                <span>Anti-Cheat Monitored</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Active monitoring to ensure fair play for all teams.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0d111a]/90 border border-slate-800">
              <div className="text-purple-400 font-bold flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                <span>Live Leaderboard</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Real-time scores, challenge solves, and rankings.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => {
                playCyberBlip(700);
                onExploreScoreboard();
              }}
              className="px-4 py-2 rounded-xl bg-[#080b12] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>Preview Live Scoreboard as Guest</span>
            </button>
          </div>

          {/* Developer Credits Card */}
          <div className="p-3 rounded-xl bg-[#080b12]/80 border border-slate-800/80 text-xs space-y-1.5">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-[#00ff66]" />
              <span>Platform Engineering &amp; Development</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-400">Core Developer:</span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-bold">
                Abhirup
              </span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-400">Secondary Devs:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                Shrikant
              </span>
              <span className="text-slate-500">&amp;</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                Anuj
              </span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-amber-400 font-medium">Special Thanks:</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold">
                Tester Sagar
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: High-Impact Registration / Login Form */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl bg-[#0d111a]/95 backdrop-blur-xl border-2 border-[#00ff66]/40 p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(0,255,102,0.05)] relative overflow-hidden">
            {/* Top Glow Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00ff66] to-transparent" />

            {/* Tab Switcher: Sign Up vs Login */}
            <div className="flex items-center gap-1 bg-[#080b12] p-1.5 rounded-xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  playCyberBlip(700);
                  setActiveTab('signup');
                  setError(null);
                }}
                className={`flex-1 py-2.5 rounded-lg font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'signup'
                    ? 'bg-[#00ff66] text-black shadow-[0_0_15px_rgba(0,255,102,0.35)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>REGISTER NEW TEAM</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playCyberBlip(700);
                  setActiveTab('login');
                  setError(null);
                }}
                className={`flex-1 py-2.5 rounded-lg font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'login'
                    ? 'bg-[#00ff66] text-black shadow-[0_0_15px_rgba(0,255,102,0.35)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>LOG IN</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl mb-4 bg-red-950/70 border border-red-500/50 text-red-300 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. REGISTRATION FORM */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">
                    TEAM NAME <span className="text-[#00ff66]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signupTeamName}
                    onChange={(e) => setSignupTeamName(e.target.value)}
                    placeholder="e.g. ByteBreakers"
                    className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Must be unique across all participating teams.
                  </span>
                </div>

                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">
                    EMAIL ADDRESS <span className="text-[#00ff66]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="e.g. teamlead@example.com"
                    className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Official contact email. Strictly 1 team per email to ensure fair play.
                  </span>
                </div>

                {/* Password input */}
                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">
                    PASSWORD <span className="text-[#00ff66]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Min 8 characters (letters + numbers)"
                      className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl pl-3.5 pr-9 py-2.5 text-xs text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

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
                        <span className="text-slate-500">Secure Salted Hash</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">
                    CONFIRM PASSWORD <span className="text-[#00ff66]">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all"
                  />
                </div>

                {/* Squad Members */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold text-xs flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>TEAM MEMBERS ({members.length}/3 MAX)</span>
                    </label>

                    {members.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddMember}
                        className="text-[11px] text-[#00ff66] hover:underline flex items-center gap-1 font-bold"
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
                          className="flex-1 bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                        {members.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="p-2 text-slate-500 hover:text-red-400 rounded-xl bg-slate-900 border border-slate-800"
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
                    className="w-full py-3.5 bg-[#00ff66] hover:bg-[#00ff66]/85 text-black font-mono font-black tracking-wider uppercase text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:shadow-[0_0_30px_rgba(0,255,102,0.7)] transition-all disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    <span>{isLoading ? 'CREATING TEAM...' : 'REGISTER TEAM & CONTINUE'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">
                    TEAM NAME OR EMAIL <span className="text-[#00ff66]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={loginTeamName}
                    onChange={(e) => setLoginTeamName(e.target.value)}
                    placeholder="Enter team name or email"
                    className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">
                    PASSWORD <span className="text-[#00ff66]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] rounded-xl pl-3.5 pr-9 py-2.5 text-xs text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-[#00ff66] hover:bg-[#00ff66]/85 text-black font-mono font-black tracking-wider uppercase text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:shadow-[0_0_30px_rgba(0,255,102,0.7)] transition-all disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{isLoading ? 'SIGNING IN...' : 'SIGN IN & CONTINUE'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
