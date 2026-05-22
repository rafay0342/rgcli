import fs from "fs";
import path from "path";
import { exec } from "child_process";
import chalk from "chalk";
import inquirer from "inquirer";
import boxen from "boxen";
import {
  renderBox,
  renderDiffBox,
  renderCodeBox,
  printSuccess,
  printError,
  printWarning,
} from "./ui.js";
import { getSessionState } from "./state.js";

// ──────────────────────────────────────────────
//  Sandbox Policy
// ──────────────────────────────────────────────

const SANDBOX_RULES = {
  "read-only": {
    allowed: new Set(["read"]),
    label: "read-only",
  },
  "workspace-write": {
    allowed: new Set(["read", "write", "patch", "delete", "mkdir"]),
    label: "workspace-write",
  },
  "danger-full-access": {
    allowed: new Set(["read", "write", "patch", "delete", "mkdir", "execute"]),
    label: "danger-full-access",
  },
};

/**
 * Checks whether the current sandbox mode permits the given action type.
 * For workspace-write mode, also enforces that file paths stay within cwd.
 * Returns { allowed: boolean, reason?: string }
 */
function checkSandbox(actionType, targetPath) {
  const state = getSessionState();
  const mode = state.sandboxMode || "danger-full-access";
  const rules = SANDBOX_RULES[mode];

  if (!rules) {
    return {
      allowed: false,
      reason: `Unknown sandbox mode "${mode}".`,
    };
  }

  if (!rules.allowed.has(actionType)) {
    return {
      allowed: false,
      reason: `Sandbox mode "${rules.label}" does not allow "${actionType}" actions.`,
    };
  }

  // workspace-write: enforce cwd boundary for mutating file operations
  if (mode === "workspace-write" && targetPath) {
    const resolvedTarget = path.resolve(state.cwd, targetPath);
    const resolvedCwd = path.resolve(state.cwd);
    if (!resolvedTarget.startsWith(resolvedCwd + path.sep) && resolvedTarget !== resolvedCwd) {
      return {
        allowed: false,
        reason: `Path "${targetPath}" is outside the current workspace. Sandbox mode "${rules.label}" only permits operations within "${resolvedCwd}".`,
      };
    }
  }

  return { allowed: true };
}

// ──────────────────────────────────────────────
//  Approval Policy
// ──────────────────────────────────────────────

/**
 * Determines whether the user must be prompted for approval.
 * Returns { proceed: boolean, autoApproved: boolean, blocked: boolean }
 *
 * approvalMode values:
 *   suggest     – always ask for confirmation
 *   auto-edit   – auto-approve writes/patch/delete/mkdir, ask for execute
 *   full-auto   – auto-approve everything
 *   never       – block everything (no actions allowed)
 */
function resolveApproval(actionType) {
  const state = getSessionState();
  const mode = state.approvalMode || "suggest";

  switch (mode) {
    case "never":
      return { proceed: false, autoApproved: false, blocked: true };

    case "full-auto":
      return { proceed: true, autoApproved: true, blocked: false };

    case "auto-edit": {
      const autoTypes = new Set(["write", "patch", "delete", "mkdir", "read"]);
      if (autoTypes.has(actionType)) {
        return { proceed: true, autoApproved: true, blocked: false };
      }
      // execute still needs confirmation
      return { proceed: false, autoApproved: false, blocked: false };
    }

    case "suggest":
    default:
      // read is always auto-approved even in suggest mode
      if (actionType === "read") {
        return { proceed: true, autoApproved: true, blocked: false };
      }
      return { proceed: false, autoApproved: false, blocked: false };
  }
}

/**
 * Prompts the user for confirmation with a styled message.
 * Returns true if user confirms.
 */
async function askConfirmation(message) {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message,
      default: true,
    },
  ]);
  return confirmed;
}

// ──────────────────────────────────────────────
//  Shared helpers
// ──────────────────────────────────────────────

function resolvePath(filePath) {
  const state = getSessionState();
  return path.resolve(state.cwd, filePath);
}

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".php": "php",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".json": "json",
    ".xml": "xml",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".md": "markdown",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".fish": "bash",
    ".ps1": "powershell",
    ".bat": "bat",
    ".cmd": "bat",
    ".dockerfile": "dockerfile",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".lua": "lua",
    ".r": "r",
    ".R": "r",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".dart": "dart",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".hs": "haskell",
    ".vue": "html",
    ".svelte": "html",
  };
  return map[ext] || "plaintext";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ──────────────────────────────────────────────
//  Action Handlers
// ──────────────────────────────────────────────

/**
 * type='write' — Write content to a file.
 * Shows a diff box comparing old vs new content, asks for approval,
 * then writes the file (creating parent directories as needed).
 */
async function handleWrite(action) {
  const filePath = resolvePath(action.file);
  const relPath = action.file;

  // Read existing content for diff (empty string if new file)
  let original = "";
  let isNew = true;
  if (fs.existsSync(filePath)) {
    original = fs.readFileSync(filePath, "utf-8");
    isNew = false;
  }

  const content = action.content || "";

  // Show diff
  if (isNew) {
    console.log(
      chalk.cyan.bold("\n📄 New file: ") + chalk.white(relPath)
    );
    renderCodeBox(relPath, content, detectLanguage(relPath));
  } else {
    renderDiffBox(relPath, original, content);
  }

  // Approval
  const approval = resolveApproval("write");
  if (approval.blocked) {
    printWarning(`Action blocked: approval mode is set to "never".`);
    return { applied: false, reason: "blocked" };
  }

  let confirmed = approval.proceed;
  if (!confirmed) {
    confirmed = await askConfirmation(
      `Allow writing to ${chalk.bold(relPath)}?`
    );
  } else if (approval.autoApproved) {
    console.log(chalk.dim(`  ⚡ Auto-approved (${getSessionState().approvalMode})`));
  }

  if (!confirmed) {
    console.log(chalk.yellow("  ↩ Skipped write."));
    return { applied: false, reason: "declined" };
  }

  // Write
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  printSuccess(`Saved ${relPath} (${formatBytes(Buffer.byteLength(content, "utf-8"))})`);
  return { applied: true };
}

/**
 * type='execute' — Execute a shell command.
 * Shows the command in a box, asks for approval, runs it.
 */
async function handleExecute(action) {
  const command = action.command;
  const state = getSessionState();

  // Display the command
  renderBox(
    " 🔧 Execute Command ",
    chalk.yellowBright(command),
    "magenta"
  );

  if (action.description) {
    console.log(chalk.dim(`  Description: ${action.description}`));
  }

  // Approval
  const approval = resolveApproval("execute");
  if (approval.blocked) {
    printWarning(`Action blocked: approval mode is set to "never".`);
    return { applied: false, reason: "blocked" };
  }

  let confirmed = approval.proceed;
  if (!confirmed) {
    confirmed = await askConfirmation(
      `Allow executing: ${chalk.bold(command)}?`
    );
  } else if (approval.autoApproved) {
    console.log(chalk.dim(`  ⚡ Auto-approved (${state.approvalMode})`));
  }

  if (!confirmed) {
    console.log(chalk.yellow("  ↩ Skipped execution."));
    return { applied: false, reason: "declined" };
  }

  // Execute
  return new Promise((resolve) => {
    const cwd = action.cwd ? path.resolve(state.cwd, action.cwd) : state.cwd;
    const timeout = action.timeout || 30000;

    exec(command, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stdout && stdout.trim()) {
        console.log(
          boxen(chalk.gray(stdout.trimEnd()), {
            title: chalk.dim(" stdout "),
            titleAlignment: "left",
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderStyle: "single",
            borderColor: "gray",
            dimBorder: true,
          })
        );
      }
      if (stderr && stderr.trim()) {
        console.log(
          boxen(chalk.red(stderr.trimEnd()), {
            title: chalk.dim(" stderr "),
            titleAlignment: "left",
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderStyle: "single",
            borderColor: "red",
            dimBorder: true,
          })
        );
      }
      if (err) {
        printError(`Command failed with exit code ${err.code || 1}`);
        resolve({ applied: false, reason: "error", exitCode: err.code, stderr });
      } else {
        printSuccess("Command executed successfully.");
        resolve({ applied: true, stdout, stderr });
      }
    });
  });
}

/**
 * type='patch' — Apply a unified diff / patch to an existing file.
 * Reads the file, applies line-by-line additions/removals, writes back.
 */
async function handlePatch(action) {
  const filePath = resolvePath(action.file);
  const relPath = action.file;

  if (!fs.existsSync(filePath)) {
    printError(`Cannot patch "${relPath}": file does not exist.`);
    return { applied: false, reason: "not_found" };
  }

  const original = fs.readFileSync(filePath, "utf-8");
  let patched;

  if (action.search && action.replace !== undefined) {
    // Simple search-and-replace patch
    if (!original.includes(action.search)) {
      printError(`Patch failed: could not find the search text in "${relPath}".`);
      return { applied: false, reason: "search_not_found" };
    }
    patched = original.replace(action.search, action.replace);
  } else if (action.diff) {
    // Unified diff format — apply manually
    patched = applyUnifiedDiff(original, action.diff);
    if (patched === null) {
      printError(`Patch failed: could not apply the diff to "${relPath}".`);
      return { applied: false, reason: "diff_apply_failed" };
    }
  } else if (action.content) {
    // Full replacement content provided
    patched = action.content;
  } else {
    printError(`Patch action missing "search"/"replace", "diff", or "content" field.`);
    return { applied: false, reason: "invalid_patch" };
  }

  // Show diff
  renderDiffBox(relPath, original, patched);

  // Approval
  const approval = resolveApproval("patch");
  if (approval.blocked) {
    printWarning(`Action blocked: approval mode is set to "never".`);
    return { applied: false, reason: "blocked" };
  }

  let confirmed = approval.proceed;
  if (!confirmed) {
    confirmed = await askConfirmation(
      `Allow patching ${chalk.bold(relPath)}?`
    );
  } else if (approval.autoApproved) {
    console.log(chalk.dim(`  ⚡ Auto-approved (${getSessionState().approvalMode})`));
  }

  if (!confirmed) {
    console.log(chalk.yellow("  ↩ Skipped patch."));
    return { applied: false, reason: "declined" };
  }

  fs.writeFileSync(filePath, patched, "utf-8");
  printSuccess(`Patched ${relPath}`);
  return { applied: true };
}

/**
 * type='delete' — Delete a file with confirmation.
 */
async function handleDelete(action) {
  const filePath = resolvePath(action.file);
  const relPath = action.file;

  if (!fs.existsSync(filePath)) {
    printWarning(`File "${relPath}" does not exist — nothing to delete.`);
    return { applied: false, reason: "not_found" };
  }

  const stat = fs.statSync(filePath);
  const sizeStr = stat.isFile() ? ` (${formatBytes(stat.size)})` : " (directory)";

  renderBox(
    " 🗑️  Delete ",
    `${chalk.red.bold("File:")} ${relPath}${chalk.dim(sizeStr)}`,
    "red"
  );

  // Approval
  const approval = resolveApproval("delete");
  if (approval.blocked) {
    printWarning(`Action blocked: approval mode is set to "never".`);
    return { applied: false, reason: "blocked" };
  }

  let confirmed = approval.proceed;
  if (!confirmed) {
    confirmed = await askConfirmation(
      `Allow deleting ${chalk.bold(relPath)}?`
    );
  } else if (approval.autoApproved) {
    console.log(chalk.dim(`  ⚡ Auto-approved (${getSessionState().approvalMode})`));
  }

  if (!confirmed) {
    console.log(chalk.yellow("  ↩ Skipped deletion."));
    return { applied: false, reason: "declined" };
  }

  if (stat.isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(filePath);
  }

  printSuccess(`Deleted ${relPath}`);
  return { applied: true };
}

/**
 * type='mkdir' — Create a directory (recursively).
 */
async function handleMkdir(action) {
  const dirPath = resolvePath(action.path || action.file);
  const relPath = action.path || action.file;

  if (fs.existsSync(dirPath)) {
    printWarning(`Directory "${relPath}" already exists.`);
    return { applied: true, reason: "already_exists" };
  }

  renderBox(
    " 📁 Create Directory ",
    chalk.cyan(relPath),
    "cyan"
  );

  // Approval
  const approval = resolveApproval("mkdir");
  if (approval.blocked) {
    printWarning(`Action blocked: approval mode is set to "never".`);
    return { applied: false, reason: "blocked" };
  }

  let confirmed = approval.proceed;
  if (!confirmed) {
    confirmed = await askConfirmation(
      `Allow creating directory ${chalk.bold(relPath)}?`
    );
  } else if (approval.autoApproved) {
    console.log(chalk.dim(`  ⚡ Auto-approved (${getSessionState().approvalMode})`));
  }

  if (!confirmed) {
    console.log(chalk.yellow("  ↩ Skipped mkdir."));
    return { applied: false, reason: "declined" };
  }

  fs.mkdirSync(dirPath, { recursive: true });
  printSuccess(`Created directory ${relPath}`);
  return { applied: true };
}

/**
 * type='read' — Read and display file content in a code box.
 */
async function handleRead(action) {
  const filePath = resolvePath(action.file);
  const relPath = action.file;

  if (!fs.existsSync(filePath)) {
    printError(`File "${relPath}" does not exist.`);
    return { applied: false, reason: "not_found" };
  }

  const stat = fs.statSync(filePath);

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(filePath);
    const listing = entries
      .map((entry) => {
        const entryPath = path.join(filePath, entry);
        const entryStat = fs.statSync(entryPath);
        const icon = entryStat.isDirectory() ? "📁" : "📄";
        const size = entryStat.isFile() ? chalk.dim(` (${formatBytes(entryStat.size)})`) : "";
        return `  ${icon} ${entry}${size}`;
      })
      .join("\n");
    renderBox(` 📂 Directory: ${relPath} `, listing || chalk.dim("  (empty)"), "blue");
    return { applied: true, content: entries };
  }

  // Refuse to display very large binary files
  if (stat.size > 1024 * 1024) {
    printWarning(
      `File "${relPath}" is ${formatBytes(stat.size)} — too large to display. Showing first 200 lines.`
    );
    const content = fs.readFileSync(filePath, "utf-8");
    const truncated = content.split("\n").slice(0, 200).join("\n");
    renderCodeBox(relPath, truncated, detectLanguage(relPath));
    return { applied: true, truncated: true, content: truncated };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lineCount = content.split("\n").length;

  console.log(
    chalk.dim(
      `  ${lineCount} lines · ${formatBytes(stat.size)} · ${detectLanguage(relPath)}`
    )
  );
  renderCodeBox(relPath, content, detectLanguage(relPath));
  return { applied: true, content };
}

// ──────────────────────────────────────────────
//  Unified diff applier
// ──────────────────────────────────────────────

/**
 * Applies a unified-format diff string to the original file content.
 * Handles lines starting with '+', '-', ' ', and hunk headers (@@ ... @@).
 * Returns the patched string or null if application fails.
 */
function applyUnifiedDiff(original, diff) {
  const originalLines = original.split("\n");
  const diffLines = diff.split("\n");
  const result = [];
  let origIdx = 0;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    // Skip diff metadata lines
    if (
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("diff ") ||
      line.startsWith("index ")
    ) {
      continue;
    }

    // Hunk header: @@ -start,count +start,count @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      const hunkStart = parseInt(hunkMatch[1], 10) - 1; // convert to 0-indexed
      // Copy all lines from current position up to hunk start
      while (origIdx < hunkStart && origIdx < originalLines.length) {
        result.push(originalLines[origIdx]);
        origIdx++;
      }
      continue;
    }

    if (line.startsWith("+")) {
      // Added line — insert into result, don't advance original
      result.push(line.substring(1));
    } else if (line.startsWith("-")) {
      // Removed line — skip in original
      origIdx++;
    } else if (line.startsWith(" ") || line === "") {
      // Context line — copy from original
      if (origIdx < originalLines.length) {
        result.push(originalLines[origIdx]);
      }
      origIdx++;
    }
  }

  // Append any remaining original lines after the last hunk
  while (origIdx < originalLines.length) {
    result.push(originalLines[origIdx]);
    origIdx++;
  }

  return result.join("\n");
}

// ──────────────────────────────────────────────
//  Main dispatcher
// ──────────────────────────────────────────────

const ACTION_HANDLERS = {
  write: handleWrite,
  execute: handleExecute,
  patch: handlePatch,
  delete: handleDelete,
  mkdir: handleMkdir,
  read: handleRead,
};

/**
 * Main entry point — dispatches an action object from the backend.
 *
 * action shape:
 *   { type: 'write',   file: string, content: string }
 *   { type: 'execute', command: string, cwd?: string, timeout?: number, description?: string }
 *   { type: 'patch',   file: string, search?: string, replace?: string, diff?: string, content?: string }
 *   { type: 'delete',  file: string }
 *   { type: 'mkdir',   path: string }  (also accepts file: string)
 *   { type: 'read',    file: string }
 */
export async function executeAction(action) {
  if (!action || !action.type) {
    printError("Invalid action: missing type.");
    return { applied: false, reason: "invalid" };
  }

  const actionType = action.type.toLowerCase();

  // 1. Sandbox check
  const targetPath = action.file || action.path || null;
  const sandboxResult = checkSandbox(actionType, targetPath);
  if (!sandboxResult.allowed) {
    printError(`Sandbox blocked: ${sandboxResult.reason}`);
    return { applied: false, reason: "sandbox_blocked", detail: sandboxResult.reason };
  }

  // 2. Dispatch to handler
  const handler = ACTION_HANDLERS[actionType];
  if (!handler) {
    printError(`Unknown action type: "${action.type}".`);
    return { applied: false, reason: "unknown_type" };
  }

  try {
    return await handler(action);
  } catch (err) {
    printError(`Action "${actionType}" failed: ${err.message}`);
    if (getSessionState().verbose) {
      console.error(chalk.dim(err.stack));
    }
    return { applied: false, reason: "error", error: err.message };
  }
}

/**
 * Executes a batch of actions sequentially.
 * Returns an array of results, one per action.
 */
export async function executeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [];
  }

  const results = [];
  const total = actions.length;

  console.log(
    chalk.cyan.bold(`\n━━━ Executing ${total} action${total > 1 ? "s" : ""} ━━━\n`)
  );

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(
      chalk.dim(`[${i + 1}/${total}] `) +
        chalk.bold(action.type) +
        chalk.dim(action.file ? ` → ${action.file}` : action.command ? ` → ${action.command}` : "")
    );

    const result = await executeAction(action);
    results.push({ action: action.type, ...result });

    // If an action fails with sandbox or never-mode block, continue with others
    // but if it was a hard error in execute, optionally stop
    if (result.reason === "error" && action.type === "execute" && action.stopOnError !== false) {
      printWarning("Stopping batch execution due to command failure.");
      break;
    }
  }

  // Summary
  const applied = results.filter((r) => r.applied).length;
  const skipped = results.filter((r) => !r.applied).length;

  console.log(
    chalk.dim(`\n━━━ Done: `) +
      chalk.green.bold(`${applied} applied`) +
      chalk.dim(", ") +
      (skipped > 0 ? chalk.yellow.bold(`${skipped} skipped`) : chalk.dim("0 skipped")) +
      chalk.dim(` ━━━\n`)
  );

  return results;
}
