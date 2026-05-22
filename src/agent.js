import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execSync } from "child_process";
import { getToken, getApiUrl, getModel, setModel } from "./auth.js";
import { executeAction } from "./executor.js";
import {
  printError,
  printStep,
  printSuccess,
  renderBox,
  renderCodeBox,
  printAsciiLogo,
  printRandomWelcome,
} from "./ui.js";
import {
  getSessionState,
  updateSessionState,
  addToHistory,
  saveSession,
  loadSession,
  listSessions,
  clearHistory,
} from "./state.js";

/* ─── helpers that may not be in auth.js yet ─── */
function getSkillsDir() {
  const dir = path.join(os.homedir(), ".rgcli", "skills");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMcpConfigPath() {
  const dir = path.join(os.homedir(), ".rgcli");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "mcp.json");
}

/* ─── UI helpers not yet in ui.js ─── */
async function _chalk() {
  return (await import("chalk")).default;
}

function printWarning(msg) {
  const c = _chalkSync();
  console.log(c.yellow.bold("\n⚠ Warning: ") + c.yellow(msg) + "\n");
}

function printInfo(msg) {
  const c = _chalkSync();
  console.log(c.blueBright.bold("\nℹ ") + c.blueBright(msg) + "\n");
}

function printModelBadge(model) {
  const c = _chalkSync();
  console.log(
    c.bgMagenta.white.bold(` MODEL `) +
      " " +
      c.magentaBright.bold(model) +
      "\n"
  );
}

function printSessionStatus(state) {
  const c = _chalkSync();
  const lines = [
    `${c.bold("Session ID:")}   ${state.sessionId}`,
    `${c.bold("Sandbox:")}      ${state.sandboxMode}`,
    `${c.bold("Approvals:")}    ${state.approvalMode}`,
    `${c.bold("Model:")}        ${getModel()}`,
    `${c.bold("Reasoning:")}    ${state.reasoningEffort}`,
    `${c.bold("Compact:")}      ${state.compactMode ? "ON" : "OFF"}`,
    `${c.bold("CWD:")}          ${state.cwd}`,
    `${c.bold("Attached:")}     ${state.attachedFiles.size} file(s)`,
    `${c.bold("Active Skill:")} ${state.activeSkill || "none"}`,
    `${c.bold("History:")}      ${state.conversationHistory.length} messages`,
    `${c.bold("Image:")}        ${state.imageAttached || "none"}`,
  ];
  renderBox(" Session Status ", lines.join("\n"), "cyan");
}

function printAgentThinking() {
  const c = _chalkSync();
  console.log(c.gray("  🧠 Agent is thinking..."));
}

function printToolExecution(tool) {
  const c = _chalkSync();
  console.log(c.yellow(`  🔧 Executing tool: ${tool}`));
}

async function renderMarkdown(text) {
  const c = _chalkSync();
  if (!text) return;
  // Basic markdown rendering: headers, bold, inline code, code blocks
  const lines = text.split("\n");
  const output = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = "";

  for (const line of lines) {
    if (line.startsWith("```") && !inCodeBlock) {
      inCodeBlock = true;
      codeLang = line.slice(3).trim();
      codeBuffer = [];
      continue;
    }
    if (line.startsWith("```") && inCodeBlock) {
      inCodeBlock = false;
      try {
        const cliHighlight = await import("cli-highlight");
        const highlighted = cliHighlight.highlight(codeBuffer.join("\n"), {
          language: codeLang || "plaintext",
          ignoreIllegals: true,
        });
        output.push(highlighted);
      } catch {
        output.push(c.green(codeBuffer.join("\n")));
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    let processed = line;
    // Headers
    if (processed.startsWith("### "))
      processed = c.cyan.bold(processed.slice(4));
    else if (processed.startsWith("## "))
      processed = c.cyan.bold.underline(processed.slice(3));
    else if (processed.startsWith("# "))
      processed = c.cyan.bold.underline(processed.slice(2));
    // Bold
    processed = processed.replace(
      /\*\*(.+?)\*\*/g,
      (_, m) => c.bold(m)
    );
    // Italic
    processed = processed.replace(
      /\*(.+?)\*/g,
      (_, m) => c.italic(m)
    );
    // Inline code
    processed = processed.replace(
      /`([^`]+)`/g,
      (_, m) => c.bgGray.white(` ${m} `)
    );
    // Bullet points
    if (processed.startsWith("- "))
      processed = c.green("  • ") + processed.slice(2);
    if (/^\d+\.\s/.test(processed))
      processed = c.green("  " + processed);

    output.push(processed);
  }

  if (inCodeBlock && codeBuffer.length) {
    output.push(c.green(codeBuffer.join("\n")));
  }

  console.log(output.join("\n"));
}

// Synchronous chalk import (cached after first dynamic import)
let _chalkCache = null;
function _chalkSync() {
  if (!_chalkCache) {
    // chalk 5.x is ESM-only but we already import it at top-level transitively via ui.js
    // Fallback: use a basic wrapper
    try {
      // attempt require for chalk 4.x compat
      _chalkCache = require("chalk");
    } catch {
      // provide a pass-through if chalk not yet loaded
      const identity = (s) => s;
      const handler = {
        get(_, prop) {
          if (prop === "bold" || prop === "italic" || prop === "underline")
            return new Proxy(identity, handler);
          if (typeof identity[prop] === "function") return identity[prop];
          return new Proxy(identity, handler);
        },
        apply(target, _, args) {
          return args[0];
        },
      };
      _chalkCache = new Proxy(identity, handler);
    }
  }
  return _chalkCache;
}

// Pre-load chalk
(async () => {
  try {
    _chalkCache = (await import("chalk")).default;
  } catch {}
})();

/* ─── Binary / skip detection ─── */
const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","bmp","ico","webp","svg","mp3","mp4","avi",
  "mov","mkv","zip","tar","gz","rar","7z","exe","dll","so","dylib",
  "bin","dat","pdf","doc","docx","xls","xlsx","ppt","pptx","woff",
  "woff2","ttf","eot","class","o","pyc","pyo",
]);
const SKIP_DIRS = new Set([
  "node_modules",".git",".next","dist","build","__pycache__",".cache",
  ".vscode",".idea","coverage","vendor","target",
]);

function isBinary(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return BINARY_EXTS.has(ext);
}

/* ═══════════════════════════════════════════
   extractFileContext(input)
   ═══════════════════════════════════════════ */
export function extractFileContext(input) {
  const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match;
  const paths = [];
  const nonPaths = [];

  while ((match = regex.exec(input)) !== null) {
    const token = match[1] || match[2] || match[3];
    const resolved = path.isAbsolute(token)
      ? token
      : path.resolve(process.cwd(), token);
    if (fs.existsSync(resolved)) {
      paths.push(resolved);
    } else {
      nonPaths.push(match[0]);
    }
  }

  const extractedContext = [];
  const visited = new Set();

  function readDir(dir, depth = 0) {
    if (depth > 4 || visited.size >= 30) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (visited.size >= 30) break;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDir(full, depth + 1);
      } else if (entry.isFile()) {
        if (visited.has(full)) continue;
        visited.add(full);
        if (isBinary(full)) {
          extractedContext.push({
            path: full,
            type: "binary",
            content: `[Binary file: ${entry.name}]`,
          });
        } else {
          try {
            const raw = fs.readFileSync(full, "utf-8");
            extractedContext.push({
              path: full,
              type: "text",
              content: raw.slice(0, 10000),
            });
          } catch {
            extractedContext.push({
              path: full,
              type: "error",
              content: `[Could not read: ${full}]`,
            });
          }
        }
      }
    }
  }

  for (const p of paths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      readDir(p);
    } else if (stat.isFile()) {
      visited.add(p);
      if (isBinary(p)) {
        extractedContext.push({
          path: p,
          type: "binary",
          content: `[Binary file: ${path.basename(p)}]`,
        });
      } else {
        try {
          const raw = fs.readFileSync(p, "utf-8");
          extractedContext.push({
            path: p,
            type: "text",
            content: raw.slice(0, 10000),
          });
        } catch {
          extractedContext.push({
            path: p,
            type: "error",
            content: `[Could not read: ${p}]`,
          });
        }
      }
    }
  }

  return {
    cleanPrompt: nonPaths.join(" "),
    extractedContext,
  };
}

/* ═══════════════════════════════════════════
   loadSkillContext(skillName)
   ═══════════════════════════════════════════ */
export function loadSkillContext(skillName) {
  const promptPath = path.join(getSkillsDir(), skillName, "prompt.md");
  if (fs.existsSync(promptPath)) {
    try {
      return fs.readFileSync(promptPath, "utf-8");
    } catch {
      return `You are an AI assistant specialized in "${skillName}". Follow best practices and produce clean, production-ready output.`;
    }
  }
  // dynamic generic prompt
  return [
    `You are an AI coding agent with the "${skillName}" skill activated.`,
    `Focus all responses on the domain of "${skillName}".`,
    `Provide expert-level guidance, code, and explanations.`,
    `Always produce complete, working implementations.`,
  ].join("\n");
}

/* ═══════════════════════════════════════════
   askAgent(promptText, extraContext)
   ═══════════════════════════════════════════ */
export async function askAgent(promptText, extraContext = "") {
  const chalk = (await import("chalk")).default;
  const ora = (await import("ora")).default;

  const token = getToken();
  if (!token) {
    printError(
      "Not authenticated. Run " +
        chalk.cyan("rg login") +
        " first."
    );
    return null;
  }

  // Build final prompt
  const state = getSessionState();
  const parts = [promptText];
  if (extraContext) parts.push(`\n---\nContext:\n${extraContext}`);

  // Attach file context from state
  if (state.attachedFiles.size > 0) {
    const fileCtx = [];
    for (const fp of state.attachedFiles) {
      if (fs.existsSync(fp)) {
        if (isBinary(fp)) {
          fileCtx.push(`[Binary: ${path.basename(fp)}]`);
        } else {
          try {
            const c = fs.readFileSync(fp, "utf-8").slice(0, 10000);
            fileCtx.push(`--- ${fp} ---\n${c}\n---`);
          } catch {
            fileCtx.push(`[Unreadable: ${fp}]`);
          }
        }
      }
    }
    if (fileCtx.length) {
      parts.push(`\n---\nAttached Files:\n${fileCtx.join("\n\n")}`);
    }
  }

  // Active skill context
  if (state.activeSkill) {
    const skillCtx = loadSkillContext(state.activeSkill);
    parts.push(`\n---\nActive Skill (${state.activeSkill}):\n${skillCtx}`);
  }

  // Image context
  if (state.imageAttached) {
    parts.push(`\n---\n[Image attached: ${state.imageAttached}]`);
  }

  // Reasoning effort
  if (state.reasoningEffort && state.reasoningEffort !== "medium") {
    parts.push(`\n[Reasoning effort: ${state.reasoningEffort}]`);
  }

  const finalPrompt = parts.join("\n");

  const spinner = ora({ text: "Thinking...", spinner: "dots12" }).start();

  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Google access token detection (OAuth tokens are long)
    if (token.length > 100) {
      headers["Google-Access-Token"] = token;
    }

    const model = getModel();
    if (model && model !== "default") {
      headers["X-Model-Override"] = model;
    }

    const apiUrl = getApiUrl();
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: finalPrompt }),
    });

    const rawText = await resp.text();

    // Check for HTML error pages
    if (rawText.toLowerCase().includes("<html")) {
      spinner.stop();
      printError(
        "Endpoint not available. The server returned an HTML page instead of JSON."
      );
      return null;
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      spinner.stop();
      printError("Invalid response from backend. Could not parse JSON.");
      if (rawText.length < 500) {
        console.log(_chalkSync().gray(`Raw response: ${rawText.slice(0, 300)}`));
      }
      return null;
    }

    if (!resp.ok) {
      spinner.stop();
      const errMsg =
        data.error || data.message || data.msg || `HTTP ${resp.status}`;
      printError(`Backend error: ${errMsg}`);
      return null;
    }

    spinner.stop();

    // Render the response message
    const message = data.message || data.response || data.text || data.content || "";
    if (message) {
      console.log("");
      renderMarkdown(message);
      console.log("");
    }

    // Execute any actions the agent returned
    if (Array.isArray(data.actions)) {
      for (const action of data.actions) {
        await executeAction(action);
      }
    }

    // Save to conversation history
    addToHistory("user", promptText);
    addToHistory("assistant", message);

    return data;
  } catch (err) {
    spinner.stop();
    if (err.code === "ECONNREFUSED") {
      printError(
        "Cannot connect to the RafayGen backend. Is the server running?"
      );
    } else if (err.code === "ENOTFOUND") {
      printError("DNS resolution failed. Check your API URL.");
    } else {
      printError(`Request failed: ${err.message}`);
    }
    return null;
  }
}

/* ═══════════════════════════════════════════
   MCP helpers
   ═══════════════════════════════════════════ */
function loadMcpConfig() {
  const p = getMcpConfigPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      return { servers: [] };
    }
  }
  return { servers: [] };
}

function saveMcpConfig(config) {
  const p = getMcpConfigPath();
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
}

/* ═══════════════════════════════════════════
   startInteractiveLoop()
   ═══════════════════════════════════════════ */
export async function startInteractiveLoop() {
  const chalk = (await import("chalk")).default;
  const inquirer = (await import("inquirer")).default;
  _chalkCache = chalk;

  // ── Welcome ──
  printAsciiLogo();
  printRandomWelcome();
  const state = getSessionState();
  console.log(
    chalk.gray(
      `  Session: ${state.sessionId.slice(0, 8)}...  |  Model: ${getModel()}  |  Sandbox: ${state.sandboxMode}`
    )
  );
  console.log(
    chalk.gray(`  Type ${chalk.white("/help")} for commands, or just start chatting.\n`)
  );

  // ── REPL ──
  while (true) {
    let input;
    try {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: chalk.greenBright("❯"),
          prefix: "",
        },
      ]);
      input = (answers.input || "").trim();
    } catch {
      // Ctrl+C or EOF
      saveSession();
      console.log(chalk.gray("\nSession saved. Goodbye!\n"));
      process.exit(0);
    }

    if (!input) continue;

    /* ─────────────────────────────────────
       SLASH COMMANDS
       ───────────────────────────────────── */

    // /exit, /quit
    if (input === "/exit" || input === "/quit") {
      saveSession();
      console.log(chalk.cyan("\n  💾 Session saved. See you next time!\n"));
      process.exit(0);
    }

    // /clear
    if (input === "/clear") {
      console.clear();
      continue;
    }

    // / (command palette)
    if (input === "/") {
      const commands = [
        { name: "📋 /help         — Show all commands", value: "/help" },
        { name: "🤖 /models       — Switch AI model", value: "/models" },
        { name: "📊 /status       — Show session status", value: "/status" },
        { name: "📝 /history      — View conversation history", value: "/history" },
        { name: "🔀 /fork         — Fork current session", value: "/fork" },
        { name: "⏪ /resume       — Resume a saved session", value: "/resume" },
        { name: "📦 /compact      — Toggle compact mode", value: "/compact" },
        { name: "🔍 /review       — Review code in CWD", value: "/review" },
        { name: "📄 /diff         — Show git diff", value: "/diff" },
        { name: "📎 /attach       — Attach file/folder", value: "/attach" },
        { name: "🗑  /detach       — Clear attachments", value: "/detach" },
        { name: "🌐 /web          — Web search", value: "/web" },
        { name: "🖼  /vision       — Attach image", value: "/vision" },
        { name: "🔎 /search       — Search in CWD", value: "/search" },
        { name: "🔒 /sandbox      — Set sandbox mode", value: "/sandbox" },
        { name: "✅ /approvals    — Set approval mode", value: "/approvals" },
        { name: "🧩 /skills       — List skills", value: "/skills" },
        { name: "🔌 /mcp          — MCP servers", value: "/mcp" },
        { name: "🧠 /reasoning    — Set reasoning effort", value: "/reasoning" },
        { name: "🚪 /exit         — Save & exit", value: "/exit" },
      ];
      const { cmd } = await inquirer.prompt([
        {
          type: "list",
          name: "cmd",
          message: "Command Palette",
          choices: commands,
          pageSize: 20,
        },
      ]);
      // Re-process the selected command
      input = cmd;
      if (input === "/exit") {
        saveSession();
        console.log(chalk.cyan("\n  💾 Session saved. See you next time!\n"));
        process.exit(0);
      }
      // fall through to handle below
    }

    // /help
    if (input === "/help") {
      const helpText = [
        chalk.cyan.bold.underline("  RafayGen CLI — Command Reference\n"),
        chalk.yellow.bold("  Basic:"),
        `    ${chalk.white("/help")}                  Show this help`,
        `    ${chalk.white("/clear")}                 Clear console`,
        `    ${chalk.white("/exit, /quit")}           Save session & exit`,
        "",
        chalk.yellow.bold("  Model Management:"),
        `    ${chalk.white("/models, /model")}        Pick an AI model`,
        "",
        chalk.yellow.bold("  Session Management:"),
        `    ${chalk.white("/status")}                Show full session state`,
        `    ${chalk.white("/compact")}               Toggle compact output mode`,
        `    ${chalk.white("/fork")}                  Fork session with same history`,
        `    ${chalk.white("/resume")}                Resume a saved session`,
        `    ${chalk.white("/history")}               Show last 10 conversation turns`,
        "",
        chalk.yellow.bold("  Code Workflows:"),
        `    ${chalk.white("/review")}                Ask agent to review code in CWD`,
        `    ${chalk.white("/diff")}                  Show git diff of CWD`,
        `    ${chalk.white("/attach <path>")}         Attach file or folder to context`,
        `    ${chalk.white("/detach")}                Clear all attached files`,
        "",
        chalk.yellow.bold("  File Operations:"),
        `    ${chalk.white("/web <query>")}           Force web search context`,
        `    ${chalk.white("/vision <path>")}         Attach image to context`,
        `    ${chalk.white("/search <query>")}        Grep search in CWD`,
        "",
        chalk.yellow.bold("  Sandbox & Approvals:"),
        `    ${chalk.white("/sandbox [mode]")}        Set sandbox (read-only|workspace-write|danger-full-access)`,
        `    ${chalk.white("/approvals [mode]")}      Set approval (suggest|auto-edit|full-auto|never)`,
        "",
        chalk.yellow.bold("  Skills:"),
        `    ${chalk.white("/skills")}                List installed & built-in skills`,
        `    ${chalk.white("/skill install <name>")}  Install a new skill`,
        `    ${chalk.white("/skill remove <name>")}   Remove a skill`,
        `    ${chalk.white("/skill enable <name>")}   Set active skill`,
        `    ${chalk.white("/skill disable <name>")}  Deactivate skill`,
        `    ${chalk.white("$<skill> <prompt>")}      Run prompt with skill context`,
        "",
        chalk.yellow.bold("  MCP (Model Context Protocol):"),
        `    ${chalk.white("/mcp")}                   List MCP servers`,
        `    ${chalk.white("/mcp add")}               Add an MCP server`,
        `    ${chalk.white("/mcp remove <name>")}     Remove an MCP server`,
        `    ${chalk.white("/mcp inspect <name>")}    Inspect MCP server config`,
        "",
        chalk.yellow.bold("  Agent Reasoning:"),
        `    ${chalk.white("/reasoning <level>")}     Set reasoning effort (low|medium|high)`,
        "",
        chalk.yellow.bold("  Tips:"),
        `    ${chalk.gray("•")} Drag & drop files into the prompt to auto-attach context`,
        `    ${chalk.gray("•")} Type ${chalk.white("/")} alone to open the command palette`,
        "",
      ].join("\n");
      console.log(helpText);
      continue;
    }

    // /models, /model
    if (input === "/models" || input === "/model") {
      const modelChoices = [
        { name: "Google Gemini (Default)", value: "default" },
        { name: "Groq — Llama 3.1 70B", value: "groq-llama-3.1-70b" },
        { name: "Mistral — Large", value: "mistral-large" },
        { name: "DeepSeek — Coder", value: "deepseek-coder" },
        { name: "Qwen — Max", value: "qwen-max" },
        { name: "Ollama — Cloud", value: "ollama-cloud" },
        { name: "MuleRouter — Auto", value: "mulerouter-auto" },
        { name: "HuggingFace — Zephyr", value: "huggingface-zephyr" },
      ];
      const { selectedModel } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedModel",
          message: "Select an AI model:",
          choices: modelChoices,
        },
      ]);
      setModel(selectedModel);
      printModelBadge(
        modelChoices.find((m) => m.value === selectedModel)?.name ||
          selectedModel
      );
      printSuccess(`Model switched to ${selectedModel}`);
      continue;
    }

    // /status
    if (input === "/status") {
      printSessionStatus(getSessionState());
      continue;
    }

    // /compact
    if (input === "/compact") {
      const cur = getSessionState();
      updateSessionState({ compactMode: !cur.compactMode });
      const newVal = getSessionState().compactMode;
      printSuccess(`Compact mode ${newVal ? "ENABLED" : "DISABLED"}`);
      continue;
    }

    // /fork
    if (input === "/fork") {
      saveSession();
      const oldId = getSessionState().sessionId;
      const newId = crypto.randomUUID();
      updateSessionState({ sessionId: newId });
      saveSession();
      console.log(chalk.green(`\n  🔀 Session forked!`));
      console.log(chalk.gray(`     Old: ${oldId}`));
      console.log(chalk.cyan(`     New: ${newId}\n`));
      continue;
    }

    // /resume
    if (input === "/resume") {
      const sessions = listSessions();
      if (sessions.length === 0) {
        printWarning("No saved sessions found.");
        continue;
      }
      const choices = sessions.map((s) => ({
        name: `${s.sessionId.slice(0, 8)}...  |  ${s.messageCount} msgs  |  ${s.savedAt || "unknown"}`,
        value: s.sessionId,
      }));
      const { sessionId } = await inquirer.prompt([
        {
          type: "list",
          name: "sessionId",
          message: "Select a session to resume:",
          choices,
          pageSize: 15,
        },
      ]);
      if (loadSession(sessionId)) {
        printSuccess(`Resumed session ${sessionId.slice(0, 8)}...`);
        printSessionStatus(getSessionState());
      } else {
        printError(`Failed to load session ${sessionId}`);
      }
      continue;
    }

    // /history
    if (input === "/history") {
      const hist = getSessionState().conversationHistory;
      if (hist.length === 0) {
        printInfo("No conversation history yet.");
        continue;
      }
      const last10 = hist.slice(-10);
      console.log(chalk.cyan.bold("\n  📝 Conversation History (last 10):\n"));
      for (const entry of last10) {
        const role =
          entry.role === "user"
            ? chalk.greenBright.bold("  YOU: ")
            : entry.role === "assistant"
            ? chalk.magentaBright.bold("  AI:  ")
            : chalk.gray.bold("  SYS: ");
        const ts = entry.timestamp
          ? chalk.gray(` [${new Date(entry.timestamp).toLocaleTimeString()}]`)
          : "";
        const content =
          entry.content.length > 200
            ? entry.content.slice(0, 200) + "..."
            : entry.content;
        console.log(role + content + ts);
        console.log(chalk.gray("  " + "─".repeat(60)));
      }
      console.log("");
      continue;
    }

    // /review
    if (input === "/review") {
      const cwd = getSessionState().cwd;
      printStep(`Scanning ${cwd} for code review...`);
      const { extractedContext } = extractFileContext(cwd);
      const contextStr = extractedContext
        .filter((f) => f.type === "text")
        .map((f) => `--- ${f.path} ---\n${f.content}`)
        .join("\n\n");
      if (!contextStr) {
        printWarning("No readable files found in current directory.");
        continue;
      }
      await askAgent(
        "Please review the following code. Identify bugs, security issues, performance problems, and suggest improvements.",
        contextStr.slice(0, 50000)
      );
      continue;
    }

    // /diff
    if (input === "/diff") {
      const cwd = getSessionState().cwd;
      try {
        const diffOutput = execSync("git diff", {
          cwd,
          encoding: "utf-8",
          timeout: 10000,
        });
        if (diffOutput.trim()) {
          renderBox(" Git Diff ", diffOutput, "yellow");
        } else {
          printInfo("No uncommitted changes found.");
        }
      } catch (err) {
        if (err.message.includes("not a git repository")) {
          printError("Not a git repository.");
        } else {
          printError(`git diff failed: ${err.message}`);
        }
      }
      continue;
    }

    // /attach <path>
    if (input.startsWith("/attach")) {
      const arg = input.slice(7).trim();
      if (!arg) {
        const { filePath } = await inquirer.prompt([
          {
            type: "input",
            name: "filePath",
            message: "Path to attach:",
          },
        ]);
        if (filePath.trim()) {
          const resolved = path.isAbsolute(filePath.trim())
            ? filePath.trim()
            : path.resolve(process.cwd(), filePath.trim());
          if (fs.existsSync(resolved)) {
            const cur = getSessionState();
            cur.attachedFiles.add(resolved);
            updateSessionState({ attachedFiles: cur.attachedFiles });
            printSuccess(`Attached: ${resolved}`);
          } else {
            printError(`Path not found: ${filePath.trim()}`);
          }
        }
      } else {
        const resolved = path.isAbsolute(arg)
          ? arg
          : path.resolve(process.cwd(), arg);
        if (fs.existsSync(resolved)) {
          const cur = getSessionState();
          cur.attachedFiles.add(resolved);
          updateSessionState({ attachedFiles: cur.attachedFiles });
          printSuccess(`Attached: ${resolved}`);
        } else {
          printError(`Path not found: ${arg}`);
        }
      }
      continue;
    }

    // /detach
    if (input === "/detach") {
      updateSessionState({ attachedFiles: new Set() });
      printSuccess("All attached files cleared.");
      continue;
    }

    // /web <query>
    if (input.startsWith("/web")) {
      const query = input.slice(4).trim();
      if (!query) {
        printWarning("Usage: /web <search query>");
        continue;
      }
      await askAgent(
        `Perform a web search for: "${query}" and summarize the results.`,
        `[Web search context requested for: ${query}]`
      );
      continue;
    }

    // /vision <path>
    if (input.startsWith("/vision")) {
      const imgPath = input.slice(7).trim();
      if (!imgPath) {
        printWarning("Usage: /vision <image-path>");
        continue;
      }
      const resolved = path.isAbsolute(imgPath)
        ? imgPath
        : path.resolve(process.cwd(), imgPath);
      if (!fs.existsSync(resolved)) {
        printError(`Image not found: ${resolved}`);
        continue;
      }
      updateSessionState({ imageAttached: resolved });
      printSuccess(`Image attached: ${resolved}`);
      continue;
    }

    // /search <query>
    if (input.startsWith("/search")) {
      const query = input.slice(7).trim();
      if (!query) {
        printWarning("Usage: /search <query>");
        continue;
      }
      const cwd = getSessionState().cwd;
      try {
        let result;
        try {
          result = execSync(
            `grep -rnI --include="*.{js,ts,py,json,md,jsx,tsx,css,html,yaml,yml,toml,go,rs,java,c,cpp,h}" "${query}" .`,
            { cwd, encoding: "utf-8", timeout: 15000 }
          );
        } catch {
          // fallback to simple grep
          result = execSync(`grep -rnI "${query}" . 2>/dev/null | head -50`, {
            cwd,
            encoding: "utf-8",
            timeout: 15000,
          });
        }
        if (result.trim()) {
          renderBox(` Search: "${query}" `, result.trim().slice(0, 5000), "green");
        } else {
          printInfo(`No results found for "${query}".`);
        }
      } catch {
        printInfo(`No results found for "${query}".`);
      }
      continue;
    }

    // /sandbox [mode]
    if (input.startsWith("/sandbox")) {
      const arg = input.slice(8).trim();
      const validModes = ["read-only", "workspace-write", "danger-full-access"];
      if (arg && validModes.includes(arg)) {
        updateSessionState({ sandboxMode: arg });
        printSuccess(`Sandbox mode set to: ${arg}`);
      } else {
        const { mode } = await inquirer.prompt([
          {
            type: "list",
            name: "mode",
            message: "Select sandbox mode:",
            choices: [
              { name: "🔒 Read-Only — No file writes allowed", value: "read-only" },
              { name: "📝 Workspace Write — Write to project files", value: "workspace-write" },
              { name: "⚠️  Danger Full Access — Full system access", value: "danger-full-access" },
            ],
          },
        ]);
        updateSessionState({ sandboxMode: mode });
        printSuccess(`Sandbox mode set to: ${mode}`);
      }
      continue;
    }

    // /approvals [mode]
    if (input.startsWith("/approvals")) {
      const arg = input.slice(10).trim();
      const validModes = ["suggest", "auto-edit", "full-auto", "never"];
      if (arg && validModes.includes(arg)) {
        updateSessionState({ approvalMode: arg });
        printSuccess(`Approval mode set to: ${arg}`);
      } else {
        const { mode } = await inquirer.prompt([
          {
            type: "list",
            name: "mode",
            message: "Select approval mode:",
            choices: [
              { name: "💬 Suggest — Show diffs, ask before writing", value: "suggest" },
              { name: "✏️  Auto-Edit — Auto-apply edits, ask for commands", value: "auto-edit" },
              { name: "🚀 Full-Auto — Apply everything automatically", value: "full-auto" },
              { name: "🚫 Never — Block all actions", value: "never" },
            ],
          },
        ]);
        updateSessionState({ approvalMode: mode });
        printSuccess(`Approval mode set to: ${mode}`);
      }
      continue;
    }

    // /skills
    if (input === "/skills") {
      const skillsDir = getSkillsDir();
      let installed = [];
      try {
        installed = fs
          .readdirSync(skillsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
      } catch {}

      const builtIn = [
        "code-review",
        "refactor",
        "test-gen",
        "docs-gen",
        "debug",
        "optimize",
        "security-audit",
        "api-design",
        "database-schema",
        "devops",
      ];

      console.log(chalk.cyan.bold("\n  🧩 Installed Skills:\n"));
      if (installed.length === 0) {
        console.log(chalk.gray("    (none installed)\n"));
      } else {
        for (const s of installed) {
          const active =
            getSessionState().activeSkill === s ? chalk.green(" ● ACTIVE") : "";
          const hasPrompt = fs.existsSync(
            path.join(skillsDir, s, "prompt.md")
          );
          console.log(
            `    ${chalk.white("•")} ${chalk.bold(s)}${active} ${
              hasPrompt ? chalk.gray("[prompt.md ✓]") : chalk.yellow("[no prompt]")
            }`
          );
        }
        console.log("");
      }

      console.log(chalk.cyan.bold("  📦 Built-in Skills:\n"));
      for (const s of builtIn) {
        console.log(`    ${chalk.white("•")} ${chalk.gray(s)}`);
      }
      console.log(
        chalk.gray(
          `\n    Use ${chalk.white("$skillname <prompt>")} to invoke a skill.\n`
        )
      );
      continue;
    }

    // /skill install|remove|enable|disable <name>
    if (input.startsWith("/skill ")) {
      const parts = input.slice(7).trim().split(/\s+/);
      const action = parts[0];
      const name = parts.slice(1).join(" ");

      if (action === "install") {
        if (!name) {
          printWarning("Usage: /skill install <name>");
          continue;
        }
        const skillDir = path.join(getSkillsDir(), name);
        if (fs.existsSync(skillDir)) {
          printWarning(`Skill "${name}" already exists.`);
          continue;
        }
        fs.mkdirSync(skillDir, { recursive: true });
        // Create prompt.md
        const promptContent = [
          `# ${name} Skill`,
          "",
          `You are an expert assistant specialized in "${name}".`,
          "",
          "## Instructions",
          "",
          `- Focus all responses on the "${name}" domain.`,
          "- Provide complete, working implementations.",
          "- Follow best practices and industry standards.",
          "- Include error handling and edge cases.",
          "- Add clear documentation and comments.",
          "",
          "## Output Format",
          "",
          "- Provide code in fenced code blocks with language tags.",
          "- Explain your reasoning before showing code.",
          "- Highlight any assumptions or trade-offs.",
          "",
        ].join("\n");
        fs.writeFileSync(path.join(skillDir, "prompt.md"), promptContent, "utf-8");

        // Create config.json
        const configContent = {
          name,
          version: "1.0.0",
          description: `Custom skill for ${name}`,
          author: os.userInfo().username,
          createdAt: new Date().toISOString(),
          tags: [name],
        };
        fs.writeFileSync(
          path.join(skillDir, "config.json"),
          JSON.stringify(configContent, null, 2),
          "utf-8"
        );

        printSuccess(
          `Skill "${name}" installed at ${skillDir}\n  Edit ${path.join(skillDir, "prompt.md")} to customize.`
        );
        continue;
      }

      if (action === "remove") {
        if (!name) {
          printWarning("Usage: /skill remove <name>");
          continue;
        }
        const skillDir = path.join(getSkillsDir(), name);
        if (!fs.existsSync(skillDir)) {
          printError(`Skill "${name}" not found.`);
          continue;
        }
        fs.rmSync(skillDir, { recursive: true, force: true });
        if (getSessionState().activeSkill === name) {
          updateSessionState({ activeSkill: null });
        }
        printSuccess(`Skill "${name}" removed.`);
        continue;
      }

      if (action === "enable") {
        if (!name) {
          printWarning("Usage: /skill enable <name>");
          continue;
        }
        updateSessionState({ activeSkill: name });
        printSuccess(`Skill "${name}" enabled as active skill.`);
        continue;
      }

      if (action === "disable") {
        if (!name) {
          printWarning("Usage: /skill disable <name>");
          continue;
        }
        if (getSessionState().activeSkill === name) {
          updateSessionState({ activeSkill: null });
          printSuccess(`Skill "${name}" disabled.`);
        } else {
          printInfo(`Skill "${name}" was not active.`);
        }
        continue;
      }

      printWarning(
        "Unknown skill command. Use: install, remove, enable, disable"
      );
      continue;
    }

    // /mcp
    if (input === "/mcp" || input === "/mcp list") {
      const config = loadMcpConfig();
      const servers = config.servers || [];
      if (servers.length === 0) {
        printInfo("No MCP servers configured.");
        console.log(
          chalk.gray(`  Use ${chalk.white("/mcp add")} to add one.\n`)
        );
      } else {
        console.log(chalk.cyan.bold("\n  🔌 MCP Servers:\n"));
        for (const s of servers) {
          console.log(
            `    ${chalk.white("•")} ${chalk.bold(s.name)} — ${chalk.gray(s.url)} ${
              s.auth ? chalk.yellow("[auth]") : chalk.gray("[no auth]")
            }`
          );
        }
        console.log("");
      }
      continue;
    }

    // /mcp add
    if (input === "/mcp add") {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Server name:",
          validate: (v) => (v.trim() ? true : "Name is required"),
        },
        {
          type: "input",
          name: "url",
          message: "Server URL:",
          validate: (v) => (v.trim() ? true : "URL is required"),
        },
        {
          type: "input",
          name: "auth",
          message: "Auth token (leave empty for none):",
        },
        {
          type: "input",
          name: "description",
          message: "Description (optional):",
        },
      ]);
      const config = loadMcpConfig();
      config.servers = config.servers || [];
      config.servers.push({
        name: answers.name.trim(),
        url: answers.url.trim(),
        auth: answers.auth.trim() || null,
        description: answers.description.trim() || "",
        addedAt: new Date().toISOString(),
      });
      saveMcpConfig(config);
      printSuccess(`MCP server "${answers.name.trim()}" added.`);
      continue;
    }

    // /mcp remove <name>
    if (input.startsWith("/mcp remove ")) {
      const name = input.slice(12).trim();
      if (!name) {
        printWarning("Usage: /mcp remove <name>");
        continue;
      }
      const config = loadMcpConfig();
      const before = (config.servers || []).length;
      config.servers = (config.servers || []).filter(
        (s) => s.name.toLowerCase() !== name.toLowerCase()
      );
      if (config.servers.length < before) {
        saveMcpConfig(config);
        printSuccess(`MCP server "${name}" removed.`);
      } else {
        printError(`MCP server "${name}" not found.`);
      }
      continue;
    }

    // /mcp inspect <name>
    if (input.startsWith("/mcp inspect ")) {
      const name = input.slice(13).trim();
      if (!name) {
        printWarning("Usage: /mcp inspect <name>");
        continue;
      }
      const config = loadMcpConfig();
      const server = (config.servers || []).find(
        (s) => s.name.toLowerCase() === name.toLowerCase()
      );
      if (server) {
        renderBox(
          ` MCP: ${server.name} `,
          [
            `Name:        ${server.name}`,
            `URL:         ${server.url}`,
            `Auth:        ${server.auth ? "••••••" + server.auth.slice(-4) : "none"}`,
            `Description: ${server.description || "(none)"}`,
            `Added:       ${server.addedAt || "unknown"}`,
          ].join("\n"),
          "magenta"
        );
      } else {
        printError(`MCP server "${name}" not found.`);
      }
      continue;
    }

    // /reasoning <level>
    if (input.startsWith("/reasoning")) {
      const level = input.slice(10).trim().toLowerCase();
      const validLevels = ["low", "medium", "high"];
      if (level && validLevels.includes(level)) {
        updateSessionState({ reasoningEffort: level });
        printSuccess(`Reasoning effort set to: ${level}`);
      } else {
        const { selected } = await inquirer.prompt([
          {
            type: "list",
            name: "selected",
            message: "Select reasoning effort:",
            choices: [
              { name: "🟢 Low — Fast, concise answers", value: "low" },
              { name: "🟡 Medium — Balanced (default)", value: "medium" },
              { name: "🔴 High — Deep analysis, slower", value: "high" },
            ],
            default: getSessionState().reasoningEffort,
          },
        ]);
        updateSessionState({ reasoningEffort: selected });
        printSuccess(`Reasoning effort set to: ${selected}`);
      }
      continue;
    }

    /* ─────────────────────────────────────
       $ SKILL EXECUTION
       ───────────────────────────────────── */
    if (input.startsWith("$")) {
      const withoutDollar = input.slice(1);
      const spaceIdx = withoutDollar.indexOf(" ");
      let skillName, skillPrompt;
      if (spaceIdx === -1) {
        skillName = withoutDollar.trim();
        skillPrompt = "";
      } else {
        skillName = withoutDollar.slice(0, spaceIdx).trim();
        skillPrompt = withoutDollar.slice(spaceIdx + 1).trim();
      }

      if (!skillName) {
        printWarning("Usage: $<skillname> <prompt>");
        continue;
      }

      const skillCtx = loadSkillContext(skillName);
      printStep(`Invoking skill: ${skillName}`);

      if (!skillPrompt) {
        const { prompt } = await inquirer.prompt([
          {
            type: "input",
            name: "prompt",
            message: `[${skillName}] Enter your prompt:`,
          },
        ]);
        skillPrompt = prompt;
      }

      if (skillPrompt.trim()) {
        await askAgent(skillPrompt, `Skill Context (${skillName}):\n${skillCtx}`);
      }
      continue;
    }

    /* ─────────────────────────────────────
       AUTO FILE CONTEXT DETECTION
       ───────────────────────────────────── */
    let finalInput = input;
    let extraCtx = "";

    // detect potential file paths in the input
    const { cleanPrompt, extractedContext } = extractFileContext(input);
    if (extractedContext.length > 0) {
      const fileContextStr = extractedContext
        .map((f) => {
          if (f.type === "text") return `--- ${f.path} ---\n${f.content}`;
          return `[${f.type}: ${f.path}]`;
        })
        .join("\n\n");
      extraCtx = fileContextStr;
      // Only use cleanPrompt if we actually found files and there's remaining text
      if (cleanPrompt.trim()) {
        finalInput = cleanPrompt.trim();
      }
    }

    /* ─────────────────────────────────────
       DEFAULT: Send to Agent
       ───────────────────────────────────── */
    await askAgent(finalInput, extraCtx);
  }
}
