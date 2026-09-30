import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Build-time guards for the three claims the product makes about itself:
 *
 *   1. no server-only secret appears in the client source,
 *   2. no emoji appears anywhere in the source or the documentation,
 *   3. no diagnostic or fake-integration wording appears in the source.
 *
 * Run by `npm run verify`. Failing any of them fails the build.
 */

const ROOTS = ['src', 'server', 'scripts', 'supabase'];
const DOC_FILES = ['README.md'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.md', '.sql', '.mjs', '.json', '.html']);

/**
 * Names that must never appear in browser code. They are legitimate inside
 * server/ - that is the whole point of the split - so the check is scoped to
 * the client surface.
 */
const FORBIDDEN_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'SMS_AUTH_SECRET',
  'TELEPHONY_AUTH_SECRET',
  'ASR_API_KEY',
];

/** Client files may not import from the server tree at all. */
const SERVER_IMPORT = /from\s+['"](\.\.\/)*(\.\.\/)*server\//;

/** A JWT-shaped literal in source is almost always a leaked key. */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{1FB00}-\u{1FBFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * Claim guards. Each pattern is paired with the phrasing that is allowed, so
 * an honest sentence about what the system does NOT do never trips the check.
 */
const CLAIM_RULES = [
  { pattern: /\bclinically depressed\b/i, note: 'diagnostic claim' },
  { pattern: /\byou (are|have been) diagnosed\b/i, note: 'diagnostic claim' },
  {
    pattern: /\bclinically validated\b/i,
    note: 'validation claim',
    // A denial is the point. Only an unqualified assertion is a failure.
    allow: /\b(not|never|nothing|no)\b[^.]{0,60}clinically validated/i,
  },
  { pattern: /\bgovernment[- ]approved\b/i, note: 'endorsement claim' },
  { pattern: /\bemergency services have been\b/i, note: 'integration claim' },
];

const files = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full);
    } else if (TEXT_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
};

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // A root that does not exist is not a failure.
  }
}
for (const doc of DOC_FILES) {
  try {
    statSync(doc);
    files.push(doc);
  } catch {
    // Optional.
  }
}

const failures = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  const isClientCode = file.split('\\').join('/').startsWith('src/');
  const isClientTest = /\.test\.tsx?$/.test(file);

  lines.forEach((line, index) => {
    const location = `${file}:${index + 1}`;

    // A browser file that imports server code would drag credentials into the
    // bundle. Tests may reach across, since they never ship.
    if (isClientCode && !isClientTest && SERVER_IMPORT.test(line)) {
      failures.push(`${location} imports from the server tree`);
    }

    for (const secret of FORBIDDEN_SECRETS) {
      if (!isClientCode) continue;
      // The names may be NAMED in a comment explaining that they are absent;
      // what must never appear is an assignment or an env read of one.
      if (
        line.includes(secret) &&
        /(=|:|process\.env|import\.meta\.env|VITE_)/.test(line) &&
        !/never|must not|forbidden|absent|deliberately|FORBIDDEN_SECRETS|belong in server/i.test(line)
      ) {
        failures.push(`${location} references ${secret}`);
      }
    }

    if (JWT_PATTERN.test(line)) failures.push(`${location} contains a JWT-shaped literal`);
    if (EMOJI_PATTERN.test(line)) failures.push(`${location} contains an emoji`);

    // This file necessarily contains the patterns it searches for.
    if (file.endsWith('check-integrity.mjs')) return;

    for (const rule of CLAIM_RULES) {
      if (rule.pattern.test(line) && !(rule.allow && rule.allow.test(line))) {
        failures.push(`${location} ${rule.note}: ${line.trim().slice(0, 90)}`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error(`Integrity check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.info(`Integrity check passed across ${files.length} files.`);
