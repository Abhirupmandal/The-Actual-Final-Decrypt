import { z } from 'zod';

// Sanitization: Escape HTML entities and prevent XSS
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Strip forbidden characters for path traversal defense
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return 'artifact.bin';
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.') // block ../ and ..
    .substring(0, 100);
}

// 1. Team Registration & Signup Schemas
export const TeamSignupSchema = z.object({
  teamName: z
    .string()
    .min(3, { message: 'Team name must contain at least 3 characters.' })
    .max(30, { message: 'Team name cannot exceed 30 characters.' })
    .regex(/^[a-zA-Z0-9_\-\s]+$/, {
      message: 'Team name may only contain letters, numbers, spaces, underscores, and hyphens.',
    }),
  email: z
    .string()
    .email({ message: 'A valid email address is required.' })
    .max(100, { message: 'Email address cannot exceed 100 characters.' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long.' })
    .max(64, { message: 'Password cannot exceed 64 characters.' })
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, {
      message: 'Password must contain at least one letter and one number.',
    }),
  members: z
    .array(
      z
        .string()
        .min(2, { message: 'Member name must be at least 2 characters.' })
        .max(25, { message: 'Member name cannot exceed 25 characters.' })
        .regex(/^[a-zA-Z0-9_\-\s]+$/, {
          message: 'Member names may only contain letters, numbers, and basic punctuation.',
        })
    )
    .min(2, { message: 'A team must have at least 2 members.' })
    .max(3, { message: 'A team can have a maximum of 3 members.' }),
});

export const TeamLoginSchema = z.object({
  teamName: z
    .string()
    .min(3, { message: 'Team name or email is required.' })
    .max(100, { message: 'Team name or email cannot exceed 100 characters.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .max(64),
});

export const TeamRegistrationSchema = TeamSignupSchema;

// 2. Admin Authentication Schema
export const AdminLoginSchema = z.object({
  password: z
    .string()
    .min(6, { message: 'Master passkey must be at least 6 characters.' })
    .max(128, { message: 'Master passkey cannot exceed 128 characters.' }),
});

// 3. Flag Submission Schema
export const FlagSubmissionSchema = z.object({
  challengeId: z
    .string()
    .min(3, { message: 'Invalid challenge ID parameter.' })
    .max(64),
  flag: z
    .string()
    .min(5, { message: 'Flag must be at least 5 characters.' })
    .max(200, { message: 'Flag payload cannot exceed 200 characters.' })
    .regex(/^CTF\{[a-zA-Z0-9_\-!@#$%^&*()+=]{2,180}\}$/, {
      message: 'Invalid flag syntax. Required format: CTF{...}',
    }),
});

// 4. Hint Purchase Schema
export const HintUnlockSchema = z.object({
  challengeId: z.string().min(3).max(64),
  hintId: z.string().min(1).max(32),
});

// 5. Challenge Create / Update Schema
export const ChallengeAdminSchema = z.object({
  title: z.string().min(2).max(150),
  section: z.enum([
    'Section A (Find the Clue, Find the Key)',
    'Section B (The Decode Chamber)',
    'Section A',
    'Section B',
  ]),
  category: z.enum([
    'CRYPTO',
    'STEGO',
    'FORENSICS',
    'REV',
    'OSINT',
    'AUDIO',
    'WEB',
    'MISC',
  ]),
  points: z.number().int().min(1).max(50000),
  difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Insane']),
  description: z.string().min(2).max(5000),
  flag: z.string().min(1).max(300),
  flagFormat: z.string().default('CTF{...}'),
  maxAttempts: z.number().int().min(1).max(100).default(5),
  hints: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        cost: z.number().min(0),
        content: z.string(),
      })
    )
    .optional(),
  attachment: z
    .object({
      fileName: z.string(),
      mimeType: z.string().optional(),
      size: z.string().optional(),
      content: z.string(),
    })
    .optional(),
});

// 6. Score Adjustment Schema
export const ScoreAdjustSchema = z.object({
  delta: z.number().int().min(-1000).max(1000),
  reason: z.string().min(3).max(200),
});

// 7. Broadcast Announcement Schema
export const AnnouncementSchema = z.object({
  title: z.string().max(80).default('COMMAND HQ BROADCAST'),
  message: z.string().min(3).max(1000),
});
