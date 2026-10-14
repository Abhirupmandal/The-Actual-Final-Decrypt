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
  | 'Section B (The Decode Chamber)'
  | 'Section A'
  | 'Section B';

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
  email?: string;
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
  strikes: number; // 10-strike disqualification rule
  isDisqualified: boolean;
  disqualifiedReason?: string;
  disqualifiedAt?: number;
  isFlaggedAnomaly: boolean;
  anomalyReason?: string;
  hasStarted?: boolean;
  startedAt?: number;
}

export interface ActivityFeedEvent {
  id: string;
  timestamp: number;
  type:
    | 'solve'
    | 'first_blood'
    | 'failed_submission'
    | 'hint_unlocked'
    | 'user_login'
    | 'user_signup'
    | 'ready_started'
    | 'artifact_view'
    | 'announcement'
    | 'system';
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
    | 'COMPETITION_STARTED'
    | 'ADMIN_PROBE_BLOCKED'
    | 'PATH_TRAVERSAL_ATTEMPT'
    | 'SCREENSHOT_ATTEMPT'
    | 'SYSTEM_ERROR';
  details: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ScreenshotAlert {
  id: string;
  teamId: string;
  teamName: string;
  email?: string;
  members?: string[];
  ip: string;
  timestamp: number;
  triggerKey?: string;
  details: string;
}

export interface CompetitionState {
  status: 'running' | 'paused' | 'ended';
  startTime: number;
  durationSeconds: number;
  remainingSeconds: number;
  writeupMode: boolean;
  matrixRainSpeed?: number;
  announcement: {
    id: string;
    title: string;
    message: string;
    timestamp: number;
    autoDismissSeconds?: number;
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
  firstBloodsCount?: number;
  totalFailedAttempts: number;
  lastSolveTime: number;
  strikes: number;
  isDisqualified: boolean;
  isFlaggedAnomaly: boolean;
}

export interface SubmissionRecord {
  id: string;
  teamId: string;
  teamName: string;
  challengeId: string;
  challengeTitle?: string;
  submittedFlag: string;
  isCorrect: boolean;
  pointsAwarded: number;
  timestamp: number;
  ip: string;
}

export type AuditActorType = 'STUDENT' | 'ADMIN' | 'SYSTEM';

export type AuditActionType =
  | 'REGISTRATION'
  | 'LOGIN'
  | 'READY_TO_START'
  | 'TAB_BLUR_WARNING'
  | 'STRIKE_INCREMENT'
  | 'DISQUALIFICATION'
  | 'REINSTATE_TEAM'
  | 'FLAG_SUBMISSION'
  | 'HINT_UNLOCK'
  | 'ADMIN_TIMER_START'
  | 'ADMIN_TIMER_PAUSE'
  | 'ADMIN_TIMER_RESUME'
  | 'ADMIN_TIMER_RESTART'
  | 'ADMIN_TIMER_SET'
  | 'ADMIN_DISQUALIFY_TEAM'
  | 'ADMIN_CLEAR_STRIKES'
  | 'ADMIN_SCORE_ADJUST'
  | 'ADMIN_CHALLENGE_CREATE'
  | 'ADMIN_CHALLENGE_UPDATE'
  | 'ADMIN_CHALLENGE_DELETE'
  | 'BROADCAST_SENT'
  | 'SCREENSHOT_INTERCEPTED'
  | 'ARTIFACT_INSPECTED'
  | 'DEVTOOLS_VIOLATION'
  | 'RATE_LIMIT_HIT'
  | 'FEEDBACK_SUBMITTED'
  | 'POST_EVENT_VIEWED';

export interface AuditLog {
  logId: string;
  actorType: AuditActorType;
  actorIdentifier: string;
  actionType: AuditActionType;
  details: string; // Detailed JSON string with metadata
  ipAddress: string;
  timestamp: string; // Exact UTC ISO Datetime string e.g. "2026-10-10T12:34:56.789Z"
  timestampMs: number;
}

export interface FeedbackSubmission {
  id: string;
  teamId: string;
  teamName: string;
  ratingUi: number; // 1-5
  challengeDifficulty: string; // 'too_easy' | 'balanced' | 'challenging' | 'too_hard'
  platformStability: number; // 1-5
  fairPlaySecurity: string; // 'seamless' | 'balanced' | 'strict' | 'needs_tuning'
  clarityRulesHints: number; // 1-5
  favoriteHighlight: string;
  suggestionsRound3: string;
  submittedAt: number;
}

