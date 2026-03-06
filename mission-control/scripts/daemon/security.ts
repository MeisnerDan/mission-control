import path from "path";

// ─── Credential Scrubbing ────────────────────────────────────────────────────

const CREDENTIAL_PATTERNS = [
  // API keys: sk-..., key-..., ak-...
  /\b(sk|key|ak|api[_-]?key)[_-][\w-]{20,}\b/gi,
  // Bearer tokens
  /Bearer\s+[\w\-.~+/]+=*/gi,
  // Base64 blobs (40+ chars, likely secrets)
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
  // AWS-style keys
  /\bAKIA[A-Z0-9]{16}\b/g,
  // Generic password patterns
  /password\s*[:=]\s*\S+/gi,
  // Email:password combos
  /[\w.+-]+@[\w-]+\.[\w.]+:[\S]+/g,
  // GitHub tokens
  /\bgh[ps]_[A-Za-z0-9_]{36,}\b/g,
  // npm tokens
  /\bnpm_[A-Za-z0-9]{36,}\b/g,
  // Slack tokens (bot, user, app, session)
  /\bxox[bpas]-[\w-]{10,}\b/g,
  // Stripe keys (secret + restricted, live + test)
  /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/g,
  // Anthropic API keys
  /\bsk-ant-[\w-]{20,}\b/g,
  // SSH private key markers
  /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  // Database connection strings (postgres, mysql, mongodb, redis)
  /\b(postgres|mysql|mongodb(\+srv)?|redis):\/\/[^\s]+/gi,
  // Generic token= patterns
  /\btoken\s*[:=]\s*[\w\-.~+/]{20,}/gi,
];

/**
 * Scrub credentials from text before logging or storing.
 * Replaces matches with [REDACTED].
 */
export function scrubCredentials(text: string): string {
  let result = text;
  for (const pattern of CREDENTIAL_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

// ─── Path Validation ─────────────────────────────────────────────────────────

/**
 * Validate that a file path resolves within the workspace root.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 */
export function validatePathWithinWorkspace(
  filePath: string,
  workspaceRoot: string
): boolean {
  const resolved = path.resolve(workspaceRoot, filePath);
  const normalizedRoot = path.resolve(workspaceRoot);
  return resolved.startsWith(normalizedRoot + path.sep) || resolved === normalizedRoot;
}

// ─── Prompt Sanitization ─────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 100_000; // 100KB max prompt

/**
 * Escape content that could break out of the task-context fence.
 * Replaces closing fence tags within the content to prevent injection.
 */
export function escapeFenceContent(content: string): string {
  return content.replace(/<\/task-context>/gi, "<\\/task-context>");
}

/**
 * Wrap task data in delimiters to structurally separate it from agent instructions.
 * This prevents task descriptions from being interpreted as agent commands.
 * Content is escaped to prevent fence breakout via injected closing tags.
 */
export function fenceTaskData(taskData: string): string {
  const escaped = escapeFenceContent(taskData);
  return `<task-context>\n${escaped}\n</task-context>`;
}

/**
 * Enforce maximum prompt length to prevent context stuffing.
 */
export function enforcePromptLimit(prompt: string): string {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return prompt.slice(0, MAX_PROMPT_LENGTH) + "\n\n[PROMPT TRUNCATED — exceeded 100KB limit]";
  }
  return prompt;
}

// ─── Spawn Safety ────────────────────────────────────────────────────────────

const ALLOWED_BINARIES = ["claude", "claude.cmd", "claude.exe"];

/**
 * Validate that only the Claude binary is being spawned.
 * Prevents arbitrary command execution.
 */
export function validateBinary(binary: string): boolean {
  const baseName = path.basename(binary).toLowerCase();
  return ALLOWED_BINARIES.includes(baseName);
}

/**
 * Build a safe environment for child processes.
 * Passes PATH, HOME/USERPROFILE, APPDATA, TEMP, and on Windows,
 * SystemRoot/WINDIR/COMSPEC/PATHEXT (required for node.exe).
 * Strips all other env vars to prevent credential leakage.
 */
export function buildSafeEnv(opts?: { agentTeams?: boolean }): Record<string, string> {
  const safeEnv: Record<string, string> = {};

  // Preserve PATH for binary resolution
  if (process.env.PATH) safeEnv.PATH = process.env.PATH;
  if (process.env.Path) safeEnv.Path = process.env.Path;

  // Preserve HOME/USERPROFILE for Claude Code config resolution
  if (process.env.HOME) safeEnv.HOME = process.env.HOME;
  if (process.env.USERPROFILE) safeEnv.USERPROFILE = process.env.USERPROFILE;

  // Preserve APPDATA for Windows applications
  if (process.env.APPDATA) safeEnv.APPDATA = process.env.APPDATA;
  if (process.env.LOCALAPPDATA) safeEnv.LOCALAPPDATA = process.env.LOCALAPPDATA;

  // Preserve temp dirs
  if (process.env.TEMP) safeEnv.TEMP = process.env.TEMP;
  if (process.env.TMP) safeEnv.TMP = process.env.TMP;

  // Windows system vars required for node.exe and native modules.
  // Without SystemRoot, node.exe can't resolve system DLLs → silent exit code 1.
  // These are read-only system paths (no secrets).
  if (process.platform === "win32") {
    if (process.env.SystemRoot) safeEnv.SystemRoot = process.env.SystemRoot;
    if (process.env.SYSTEMROOT) safeEnv.SYSTEMROOT = process.env.SYSTEMROOT;
    if (process.env.WINDIR) safeEnv.WINDIR = process.env.WINDIR;
    if (process.env.COMSPEC) safeEnv.COMSPEC = process.env.COMSPEC;
    if (process.env.PATHEXT) safeEnv.PATHEXT = process.env.PATHEXT;
  }

  // macOS: USER and LOGNAME are needed for OAuth credential lookup via Keychain.
  // Without USER, `claude -p` cannot find stored OAuth tokens and fails with "Not logged in".
  if (process.env.USER) safeEnv.USER = process.env.USER;
  if (process.env.LOGNAME) safeEnv.LOGNAME = process.env.LOGNAME;

  // Agent Teams: experimental multi-agent coordination
  if (opts?.agentTeams) {
    safeEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
  }

  return safeEnv;
}
