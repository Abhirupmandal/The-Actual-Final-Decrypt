export type ChallengeCategory =
  | 'CRYPTO'
  | 'STEGO'
  | 'FORENSICS'
  | 'REV'
  | 'OSINT'
  | 'AUDIO'
  | 'WEB'
  | 'MISC';

export type ChallengeSection =
  | 'Section A (Find the Clue, Find the Key)'
  | 'Section B (The Decode Chamber)';

export interface Hint {
  id: string;
  title: string;
  cost: number;
  content: string;
}

export interface ChallengeAttachment {
  fileName: string;
  mimeType: string;
  size: string;
  content: string;
}

export interface ChallengeWriteup {
  summary: string;
  steps: string[];
}

export interface Challenge {
  id: string;
  title: string;
  section: ChallengeSection;
  category: ChallengeCategory;
  points: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  description: string;
  flag: string;
  flagFormat: string;
  maxAttempts: number;
  attachment?: ChallengeAttachment;
  hints: Hint[];
  writeup?: ChallengeWriteup;
  isEnabled: boolean;
  solvesCount: number;
  firstBloodTeam?: string | null;
}

export interface TeamMember {
  name: string;
}

export interface SolveRecord {
  solvedAt: number;
  pointsAwarded: number;
  isFirstBlood: boolean;
}

export interface Team {
  id: string;
  teamName: string;
  passwordHash?: string;
  passwordSalt?: string;
  members: string[];
  score: number;
  solves: Record<string, SolveRecord>; // challengeId -> SolveRecord
  hintsUnlocked: Record<string, string[]>; // challengeId -> hintId[]
  failedAttempts: Record<string, number>; // challengeId -> count
  totalFailedAttempts: number;
  lastSolveTime: number;
  registeredAt: number;
  ip: string;
  strikes: number; // 5-strike disqualification rule
  isDisqualified: boolean;
  disqualifiedReason?: string;
  disqualifiedAt?: number;
  isFlaggedAnomaly: boolean;
  anomalyReason?: string;
}

export interface ActivityFeedEvent {
  id: string;
  timestamp: number;
  type: 'solve' | 'first_blood' | 'hint_unlocked' | 'announcement' | 'system';
  teamName: string;
  challengeTitle?: string;
  points?: number;
  message: string;
}

export interface SecurityLog {
  id: string;
  timestamp: number;
  teamName?: string;
  ip: string;
  type:
    | 'RATE_LIMIT'
    | 'VELOCITY_ANOMALY'
    | 'DEVTOOLS_ATTEMPT'
    | 'SECURITY_STRIKE'
    | 'TEAM_DISQUALIFIED'
    | 'INVALID_AUTH'
    | 'INPUT_VALIDATION_ERROR'
    | 'FILE_SECURITY_VIOLATION'
    | 'TAMPERED_TOKEN'
    | 'BRUTE_FORCE_LOCKOUT'
    | 'SYSTEM_ERROR';
  details: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CompetitionState {
  status: 'running' | 'paused' | 'ended';
  startTime: number;
  durationSeconds: number;
  remainingSeconds: number;
  writeupMode: boolean;
  announcement: {
    id: string;
    title: string;
    message: string;
    timestamp: number;
  } | null;
}

export interface PublicChallengeView {
  id: string;
  title: string;
  section: ChallengeSection;
  category: ChallengeCategory;
  points: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  description: string;
  flagFormat: string;
  maxAttempts: number;
  hasAttachment: boolean;
  attachmentInfo?: {
    fileName: string;
    size: string;
  };
  hints: {
    id: string;
    title: string;
    cost: number;
    isUnlocked: boolean;
    content?: string;
  }[];
  isSolved: boolean;
  isLocked: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
  firstBloodTeam?: string | null;
  writeup?: ChallengeWriteup;
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  members: string[];
  score: number;
  solvesCount: number;
  totalFailedAttempts: number;
  lastSolveTime: number;
  strikes: number;
  isDisqualified: boolean;
  isFlaggedAnomaly: boolean;
}
