import path from 'path';

// Whitelist of strictly permitted extensions for downloadable artifacts
const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.wav',
  '.mp3',
  '.txt',
  '.log',
  '.py',
  '.c',
  '.cpp',
  '.bin',
  '.raw',
  '.pcap',
  '.zip',
  '.json',
  '.dump',
]);

// Explicit blacklist of dangerous and executable extensions
const FORBIDDEN_EXTENSIONS = new Set([
  '.php',
  '.phtml',
  '.php5',
  '.exe',
  '.sh',
  '.bash',
  '.bat',
  '.cmd',
  '.msi',
  '.vbs',
  '.scr',
  '.pl',
  '.jar',
  '.svg', // Blocks SVG Stored-XSS injection
  '.html',
  '.htm',
  '.xhtml',
  '.jsp',
  '.asp',
  '.aspx',
  '.cgi',
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileValidationResult {
  valid: boolean;
  sanitizedFilename: string;
  error?: string;
}

export function validateFileAttachment(
  filename: string,
  contentOrBufferSize: number
): FileValidationResult {
  // 1. Path traversal & filename sanitation
  const baseName = path.basename(filename);
  if (baseName.includes('..') || baseName.includes('/') || baseName.includes('\\')) {
    return { valid: false, sanitizedFilename: '', error: 'Path traversal attempt detected in filename.' };
  }

  // 2. Extension validation
  const ext = path.extname(baseName).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      sanitizedFilename: '',
      error: `Security Violation: File extension ${ext} is strictly blacklisted (executable/scripting payload).`,
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      sanitizedFilename: '',
      error: `File extension ${ext} is not on the permitted white-list.`,
    };
  }

  // 3. Payload size check
  if (contentOrBufferSize > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      sanitizedFilename: '',
      error: `File payload exceeds maximum permitted threshold of 5MB.`,
    };
  }

  // Safe sanitized name
  const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');

  return {
    valid: true,
    sanitizedFilename: cleanName,
  };
}

export function getSafeAttachmentHeaders(filename: string, mimeType: string): Record<string, string> {
  return {
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': mimeType || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'none'; sandbox",
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'private, no-transform, no-cache',
  };
}
