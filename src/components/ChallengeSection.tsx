import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Layers,
  Award,
  CheckCircle2,
  Lock,
  Terminal,
  Cpu,
  Zap,
  Target,
  Sparkles,
  BarChart3,
  LayoutGrid,
  Columns2,
  Columns3,
} from 'lucide-react';
import type { PublicChallengeView } from '../types.ts';
import { ChallengeCard } from './ChallengeCard.tsx';
import { playCyberBlip } from '../utils/audio.ts';

interface ChallengeSectionProps {
  challenges: PublicChallengeView[];
  teamLoggedIn: boolean;
  currentTeamName?: string;
  isLockedOrEnded?: boolean;
  onOpenAuthModal: () => void;
  onViewWriteup: (challenge: PublicChallengeView) => void;
  onRefreshState: () => void;
  onViewArtifact?: (challengeId: string) => void;
}

export const ChallengeSection: React.FC<ChallengeSectionProps> = ({
  challenges,
  teamLoggedIn,
  currentTeamName,
  isLockedOrEnded = false,
  onOpenAuthModal,
  onViewWriteup,
  onRefreshState,
  onViewArtifact,
}) => {
  const [selectedSection, setSelectedSection] = useState<'ALL' | 'SECTION_A' | 'SECTION_B'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'UNSOLVED' | 'SOLVED' | 'LOCKED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridColumns, setGridColumns] = useState<2 | 3>(2);

  const categories = ['ALL', 'CRYPTO', 'STEGO', 'FORENSICS', 'WEB', 'REV', 'OSINT', 'AUDIO', 'MISC'];

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      // Section filter
      if (selectedSection === 'SECTION_A' && !c.section.includes('Section A')) return false;
      if (selectedSection === 'SECTION_B' && !c.section.includes('Section B')) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && c.category.toUpperCase() !== selectedCategory.toUpperCase()) return false;

      // Status filter
      if (selectedStatus === 'SOLVED' && !c.isSolved) return false;
      if (selectedStatus === 'UNSOLVED' && (c.isSolved || c.isLocked)) return false;
      if (selectedStatus === 'LOCKED' && !c.isLocked) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesCat = c.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }

      return true;
    });
  }, [challenges, selectedSection, selectedCategory, selectedStatus, searchQuery]);

  // Statistics calculation
  const totalPoints = useMemo(() => challenges.reduce((acc, c) => acc + c.points, 0), [challenges]);
  const solvedCount = useMemo(() => challenges.filter((c) => c.isSolved).length, [challenges]);
  const solvedPoints = useMemo(() => challenges.filter((c) => c.isSolved).reduce((acc, c) => acc + c.points, 0), [challenges]);
  const solvedPct = challenges.length > 0 ? Math.round((solvedCount / challenges.length) * 100) : 0;

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    challenges.forEach((c) => {
      counts[c.category.toUpperCase()] = (counts[c.category.toUpperCase()] || 0) + 1;
    });
    return counts;
  }, [challenges]);

  const getCategoryButtonGlow = (cat: string, isSelected: boolean) => {
    if (!isSelected) {
      return 'bg-[#080b12] text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700';
    }
    switch (cat.toUpperCase()) {
      case 'CRYPTO':
        return 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.4)]';
      case 'STEGO':
        return 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.4)]';
      case 'FORENSICS':
        return 'bg-[#a855f7]/15 text-[#c084fc] border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.4)]';
      case 'WEB':
        return 'bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.4)]';
      case 'REV':
        return 'bg-[#f43f5e]/15 text-[#fb7185] border-[#f43f5e] shadow-[0_0_12px_rgba(244,63,94,0.4)]';
      case 'OSINT':
        return 'bg-[#14b8a6]/15 text-[#2dd4bf] border-[#14b8a6] shadow-[0_0_12px_rgba(20,184,166,0.4)]';
      case 'AUDIO':
        return 'bg-[#f97316]/15 text-[#fb923c] border-[#f97316] shadow-[0_0_12px_rgba(249,115,22,0.4)]';
      default:
        return 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.4)]';
    }
  };

  return (
    <div className="space-y-6 drm-screen-shield challenge-container-shield">
      {/* Top Cyber Defense Mission HUD */}
      <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-xl border border-[#00ff66]/25 p-5 sm:p-7 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,255,102,0.04)] relative overflow-hidden">
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-80" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#00ff66] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-ping" />
              <Layers className="w-4 h-4" />
              <span>DEFENSE INTELLIGENCE HUD // ACTIVE SECTOR MATRIX</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono text-white mt-1.5 tracking-wide flex items-center gap-2">
              <span>CHALLENGE MARKETPLACE</span>
              <span className="text-xs font-mono font-bold text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/30 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                {challenges.length} TARGETS
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans mt-1 max-w-2xl leading-relaxed">
              Solve adversarial challenges across cryptography, steganography, memory forensics, binary reverse engineering, web exploitation, and threat intelligence.
            </p>
          </div>

          {/* Quick HUD Metrics with Visual Progress */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 font-mono text-xs border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-4 lg:pt-0 lg:pl-6 shrink-0">
            <div className="bg-[#080b12] p-3 rounded-xl border border-slate-800 text-center lg:text-left">
              <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1 justify-center lg:justify-start">
                <Target className="w-3 h-3 text-[#00f0ff]" />
                TOTAL POOL
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">{totalPoints} PTS</div>
            </div>

            <div className="bg-[#080b12] p-3 rounded-xl border border-emerald-500/30 text-center lg:text-left">
              <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1 justify-center lg:justify-start">
                <CheckCircle2 className="w-3 h-3 text-[#00ff66]" />
                DECRYPTED
              </div>
              <div className="text-lg sm:text-xl font-black text-[#00ff66] mt-0.5 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
                {solvedCount}/{challenges.length}
              </div>
            </div>

            <div className="bg-[#080b12] p-3 rounded-xl border border-amber-500/30 text-center lg:text-left">
              <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1 justify-center lg:justify-start">
                <Zap className="w-3 h-3 text-amber-400" />
                SCORE
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-300 mt-0.5 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                {solvedPoints} PTS
              </div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-[#00ff66]" />
              <span>SECTOR CAPTURE PROGRESS:</span>
            </span>
            <span className="text-[#00ff66] font-bold">{solvedPct}% COMPLETED</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-[#00ff66] to-[#00f0ff] shadow-[0_0_12px_rgba(0,255,102,0.6)] transition-all duration-500"
              style={{ width: `${solvedPct}%` }}
            />
          </div>
        </div>

        {/* Section Tabs Switcher */}
        <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                playCyberBlip(700);
                setSelectedSection('ALL');
              }}
              className={`px-3.5 py-2 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 ${
                selectedSection === 'ALL'
                  ? 'bg-[#00ff66] text-black shadow-[0_0_15px_rgba(0,255,102,0.4)]'
                  : 'bg-[#080b12] text-slate-300 hover:text-white border border-slate-800 hover:border-[#00ff66]/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ALL SECTORS ({challenges.length})</span>
            </button>

            <button
              onClick={() => {
                playCyberBlip(700);
                setSelectedSection('SECTION_A');
              }}
              className={`px-3.5 py-2 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 ${
                selectedSection === 'SECTION_A'
                  ? 'bg-[#00ff66] text-black shadow-[0_0_15px_rgba(0,255,102,0.4)]'
                  : 'bg-[#080b12] text-slate-300 hover:text-white border border-slate-800 hover:border-[#00ff66]/40'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>SECTION A (Find the Clue, Find the Key)</span>
            </button>

            <button
              onClick={() => {
                playCyberBlip(700);
                setSelectedSection('SECTION_B');
              }}
              className={`px-3.5 py-2 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 ${
                selectedSection === 'SECTION_B'
                  ? 'bg-[#00ff66] text-black shadow-[0_0_15px_rgba(0,255,102,0.4)]'
                  : 'bg-[#080b12] text-slate-300 hover:text-white border border-slate-800 hover:border-[#00ff66]/40'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>SECTION B (The Decode Chamber)</span>
            </button>
          </div>

          {/* Grid Layout Switcher (2-Col vs 3-Col) */}
          <div className="hidden lg:flex items-center gap-1 bg-[#080b12] p-1 rounded-xl border border-slate-800 font-mono text-xs">
            <button
              onClick={() => {
                playCyberBlip(600);
                setGridColumns(2);
              }}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                gridColumns === 2
                  ? 'bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/50 shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="2-Column Grid Layout"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>2 COL</span>
            </button>
            <button
              onClick={() => {
                playCyberBlip(600);
                setGridColumns(3);
              }}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                gridColumns === 3
                  ? 'bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/50 shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="3-Column Grid Layout"
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>3 COL</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 p-4 sm:p-5 space-y-3.5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Terminal Search Input */}
          <div className="relative flex-1 group font-mono">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-[#00ff66] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challenges by keyword, algorithm, flag format, or title..."
              className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>

          {/* Status selector tabs */}
          <div className="flex items-center gap-1 bg-[#080b12] p-1 rounded-xl border border-slate-800 shrink-0">
            {(['ALL', 'UNSOLVED', 'SOLVED', 'LOCKED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  playCyberBlip(600);
                  setSelectedStatus(st);
                }}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all font-bold ${
                  selectedStatus === st
                    ? 'bg-[#00ff66] text-black shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills Bar with Distinct Glowing Neon Borders */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar text-xs font-mono">
          <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>CATEGORIES:</span>
          </span>
          {categories.map((cat) => {
            const isSelected = selectedCategory.toUpperCase() === cat;
            const count = cat === 'ALL' ? challenges.length : categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => {
                  playCyberBlip(650);
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap flex items-center gap-1.5 font-bold ${getCategoryButtonGlow(
                  cat,
                  isSelected
                )}`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-black/40 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Challenge Cards: Responsive 2-Column or 3-Column System */}
      {filteredChallenges.length > 0 ? (
        <div
          className={`grid grid-cols-1 gap-6 transition-all duration-300 ${
            gridColumns === 3
              ? 'md:grid-cols-2 lg:grid-cols-3'
              : 'md:grid-cols-2 lg:grid-cols-2'
          }`}
        >
          {filteredChallenges.map((chal) => (
            <ChallengeCard
              key={chal.id}
              challenge={chal}
              teamLoggedIn={teamLoggedIn}
              currentTeamName={currentTeamName}
              isLockedOrEnded={isLockedOrEnded}
              onOpenAuthModal={onOpenAuthModal}
              onViewWriteup={onViewWriteup}
              onRefreshState={onRefreshState}
              onViewArtifact={onViewArtifact}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0d111a] border border-slate-800 p-16 text-center shadow-xl font-mono">
          <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
          <h3 className="text-lg font-bold text-white">
            NO CHALLENGES MATCH ACTIVE FILTER
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
            Try resetting your search query, selecting "ALL SECTORS", or clearing the category filter to view available targets.
          </p>
          <button
            onClick={() => {
              setSelectedSection('ALL');
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
              setSearchQuery('');
            }}
            className="mt-5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold transition-colors border border-slate-700"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
};
