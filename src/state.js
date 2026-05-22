import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const RGCLI_DIR = path.join(os.homedir(), '.rgcli');
const SESSIONS_DIR = path.join(RGCLI_DIR, 'sessions');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const sessionState = {
  sandboxMode: 'workspace-write',
  approvalMode: 'suggest',
  attachedFiles: new Set(),
  mcpServers: [],
  reasoningEffort: 'medium',
  verbose: false,
  compactMode: false,
  cwd: process.cwd(),
  jsonOutput: false,
  colorEnabled: true,
  skipGitCheck: false,
  autoEdit: false,
  searchEnabled: false,
  imageAttached: null,
  activeSkill: null,
  conversationHistory: [],
  sessionId: crypto.randomUUID(),
};

/**
 * Returns a shallow copy of the current session state.
 * The attachedFiles Set is copied into a new Set so external
 * mutations don't leak back into the canonical state.
 */
export function getSessionState() {
  return {
    ...sessionState,
    attachedFiles: new Set(sessionState.attachedFiles),
    mcpServers: [...sessionState.mcpServers],
    conversationHistory: [...sessionState.conversationHistory],
  };
}

/**
 * Merge partial updates into the session state.
 * Supports both plain objects and Sets / Arrays for the
 * collection fields.
 */
export function updateSessionState(newState) {
  if (!newState || typeof newState !== 'object') {
    return getSessionState();
  }

  for (const [key, value] of Object.entries(newState)) {
    if (!(key in sessionState)) {
      continue;
    }

    if (key === 'attachedFiles') {
      if (value instanceof Set) {
        sessionState.attachedFiles = new Set(value);
      } else if (Array.isArray(value)) {
        sessionState.attachedFiles = new Set(value);
      } else {
        sessionState.attachedFiles = new Set();
      }
    } else if (key === 'mcpServers') {
      sessionState.mcpServers = Array.isArray(value) ? [...value] : [];
    } else if (key === 'conversationHistory') {
      sessionState.conversationHistory = Array.isArray(value) ? [...value] : [];
    } else {
      sessionState[key] = value;
    }
  }

  return getSessionState();
}

/**
 * Attach a file to the current session context.
 * Resolves the path against the current working directory stored
 * in state so relative paths work as expected.
 */
export function attachFileContext(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(sessionState.cwd, filePath);

  if (!fs.existsSync(resolved)) {
    return false;
  }

  sessionState.attachedFiles.add(resolved);
  return true;
}

/**
 * Remove all attached files from the session.
 */
export function clearAttachedFiles() {
  sessionState.attachedFiles.clear();
}

/**
 * Append a message to the conversation history.
 * @param {'user'|'assistant'|'system'} role
 * @param {string} content
 */
export function addToHistory(role, content) {
  const validRoles = ['user', 'assistant', 'system'];
  const normalizedRole = validRoles.includes(role) ? role : 'user';

  sessionState.conversationHistory.push({
    role: normalizedRole,
    content: typeof content === 'string' ? content : String(content),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Return the full conversation history array (copy).
 */
export function getHistory() {
  return [...sessionState.conversationHistory];
}

/**
 * Clear the in-memory conversation history.
 */
export function clearHistory() {
  sessionState.conversationHistory = [];
}

/**
 * Persist the current session to disk.
 * File: ~/.rgcli/sessions/<sessionId>.json
 */
export function saveSession() {
  ensureDir(SESSIONS_DIR);

  const filePath = path.join(SESSIONS_DIR, `${sessionState.sessionId}.json`);

  const serializable = {
    sessionId: sessionState.sessionId,
    sandboxMode: sessionState.sandboxMode,
    approvalMode: sessionState.approvalMode,
    attachedFiles: [...sessionState.attachedFiles],
    mcpServers: [...sessionState.mcpServers],
    reasoningEffort: sessionState.reasoningEffort,
    verbose: sessionState.verbose,
    compactMode: sessionState.compactMode,
    cwd: sessionState.cwd,
    jsonOutput: sessionState.jsonOutput,
    colorEnabled: sessionState.colorEnabled,
    skipGitCheck: sessionState.skipGitCheck,
    autoEdit: sessionState.autoEdit,
    searchEnabled: sessionState.searchEnabled,
    imageAttached: sessionState.imageAttached,
    activeSkill: sessionState.activeSkill,
    conversationHistory: sessionState.conversationHistory,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
  return filePath;
}

/**
 * Load a previously-saved session from disk and hydrate state.
 * @param {string} id  Session UUID
 * @returns {boolean} true if loaded successfully
 */
export function loadSession(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const filePath = path.join(SESSIONS_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.sessionId) sessionState.sessionId = data.sessionId;
    if (data.sandboxMode) sessionState.sandboxMode = data.sandboxMode;
    if (data.approvalMode) sessionState.approvalMode = data.approvalMode;
    if (Array.isArray(data.attachedFiles)) {
      sessionState.attachedFiles = new Set(data.attachedFiles);
    }
    if (Array.isArray(data.mcpServers)) {
      sessionState.mcpServers = [...data.mcpServers];
    }
    if (data.reasoningEffort) sessionState.reasoningEffort = data.reasoningEffort;
    if (typeof data.verbose === 'boolean') sessionState.verbose = data.verbose;
    if (typeof data.compactMode === 'boolean') sessionState.compactMode = data.compactMode;
    if (data.cwd) sessionState.cwd = data.cwd;
    if (typeof data.jsonOutput === 'boolean') sessionState.jsonOutput = data.jsonOutput;
    if (typeof data.colorEnabled === 'boolean') sessionState.colorEnabled = data.colorEnabled;
    if (typeof data.skipGitCheck === 'boolean') sessionState.skipGitCheck = data.skipGitCheck;
    if (typeof data.autoEdit === 'boolean') sessionState.autoEdit = data.autoEdit;
    if (typeof data.searchEnabled === 'boolean') sessionState.searchEnabled = data.searchEnabled;
    sessionState.imageAttached = data.imageAttached ?? null;
    sessionState.activeSkill = data.activeSkill ?? null;
    if (Array.isArray(data.conversationHistory)) {
      sessionState.conversationHistory = [...data.conversationHistory];
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * List every saved session with basic metadata.
 * Returns an array of { sessionId, savedAt, messageCount, filePath }.
 */
export function listSessions() {
  ensureDir(SESSIONS_DIR);

  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));

  const sessions = [];

  for (const file of files) {
    const filePath = path.join(SESSIONS_DIR, file);

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      sessions.push({
        sessionId: data.sessionId || path.basename(file, '.json'),
        savedAt: data.savedAt || null,
        messageCount: Array.isArray(data.conversationHistory)
          ? data.conversationHistory.length
          : 0,
        filePath,
      });
    } catch {
      sessions.push({
        sessionId: path.basename(file, '.json'),
        savedAt: null,
        messageCount: 0,
        filePath,
      });
    }
  }

  sessions.sort((a, b) => {
    if (!a.savedAt && !b.savedAt) return 0;
    if (!a.savedAt) return 1;
    if (!b.savedAt) return -1;
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });

  return sessions;
}
