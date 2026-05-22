#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { setToken, setApiUrl, setModel, clearConfig, loadConfig } from "../src/auth.js";
import { askAgent, startInteractiveLoop } from "../src/agent.js";
import { printSuccess, printAsciiLogo } from "../src/ui.js";
import { updateSessionState } from "../src/state.js";
import fs from "fs";
import path from "path";
import os from "os";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")
);

const MCP_CONFIG_PATH = path.join(os.homedir(), ".rgcli", "mcp.json");

function loadMcpConfig() {
  try {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, "utf-8"));
    }
  } catch {
    // corrupted file – reset
  }
  return { servers: {} };
}

function saveMcpConfig(config) {
  const dir = path.dirname(MCP_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

const KNOWN_COMMANDS = [
  "login",
  "logout",
  "ask",
  "chat",
  "exec",
  "proto",
  "mcp",
];

const program = new Command();

program
  .name("rgcli")
  .description("RafayGen - The Ultimate Agentic Coding CLI")
  .version(pkg.version)
  .option("-m, --model <name>", "Override the default AI model")
  .option("--reasoning <level>", "Reasoning effort: low, medium, high")
  .option(
    "--approval-mode <mode>",
    "Approval mode: suggest, auto-edit, full-auto, never"
  )
  .option(
    "--sandbox <mode>",
    "Sandbox mode: read-only, workspace-write, danger-full-access"
  )
  .option("--full-auto", "Run without pausing for user confirmation")
  .option("--auto-edit", "Auto-approve file edits without prompting")
  .option(
    "--dangerously-bypass-approvals-and-sandbox",
    "Bypass all safety checks (DANGEROUS)"
  )
  .option("--search", "Enable web search for context")
  .option("--image <path>", "Attach an image file to the prompt")
  .option("--config", "Show current configuration")
  .option("--profile <name>", "Load a named user profile")
  .option("--cwd <path>", "Set explicit working directory")
  .option("--skip-git-repo-check", "Skip git repository detection")
  .option("--json", "Output results as JSON")
  .option("-v, --verbose", "Enable verbose debugging output")
  .option("-q, --quiet", "Suppress non-essential output")
  .option("--color", "Force color output")
  .option("--no-color", "Disable color output")
  .option("-c, --compact", "Compact conversation context");

// ── preAction hook ─────────────────────────────────────────────────────
program.hook("preAction", (_thisCommand, _actionCommand) => {
  const opts = program.opts();

  if (opts.model) setModel(opts.model);

  const newState = {};

  if (opts.sandbox) newState.sandboxMode = opts.sandbox;
  if (opts.approvalMode) newState.approvalMode = opts.approvalMode;
  if (opts.reasoning) newState.reasoningEffort = opts.reasoning;
  if (opts.cwd) newState.cwd = path.resolve(opts.cwd);
  if (opts.verbose) newState.verbose = true;
  if (opts.quiet) newState.quiet = true;
  if (opts.compact) newState.compactMode = true;
  if (opts.json) newState.jsonOutput = true;
  if (opts.skipGitRepoCheck) newState.skipGitCheck = true;
  if (opts.autoEdit) newState.autoEdit = true;
  if (opts.search) newState.searchEnabled = true;
  if (opts.image) newState.imageAttached = path.resolve(opts.image);

  if (typeof opts.color === "boolean") {
    newState.colorEnabled = opts.color;
  }

  if (opts.fullAuto) {
    newState.approvalMode = "full-auto";
  }

  if (opts.dangerouslyBypassApprovalsAndSandbox) {
    newState.sandboxMode = "danger-full-access";
    newState.approvalMode = "full-auto";
  }

  updateSessionState(newState);
});

// ── login ──────────────────────────────────────────────────────────────
program
  .command("login")
  .description("Authenticate with your RafayGen live app")
  .argument("[token]", "Your Personal Access Token")
  .option("--url <url>", "Set custom API URL")
  .action(async (token, options) => {
    if (token) {
      setToken(token);
      if (options.url) setApiUrl(options.url);
      printSuccess("Successfully logged in to RafayGen!");
    } else {
      if (options.url) setApiUrl(options.url);
      const { startAuthLoop } = await import("../src/auth.js");
      await startAuthLoop();
    }
  });

// ── logout ─────────────────────────────────────────────────────────────
program
  .command("logout")
  .description("Logout and clear stored credentials")
  .action(() => {
    clearConfig();
    printSuccess("Successfully logged out. All credentials cleared.");
  });

// ── ask ────────────────────────────────────────────────────────────────
program
  .command("ask")
  .description("Ask RafayGen a one-off question")
  .argument("<prompt...>", "What do you want to build?")
  .action(async (promptWords) => {
    const prompt = promptWords.join(" ");
    await askAgent(prompt);
    process.exit(0);
  });

// ── chat ───────────────────────────────────────────────────────────────
program
  .command("chat")
  .description("Start an interactive chat session")
  .action(() => {
    startInteractiveLoop();
  });

// ── exec ───────────────────────────────────────────────────────────────
program
  .command("exec")
  .description("Execute a single action directly without chat")
  .argument("<action...>", "The action to execute")
  .action(async (actionWords) => {
    const prompt =
      "[EXEC MODE: Execute exactly this task with no conversational filler] " +
      actionWords.join(" ");
    await askAgent(prompt);
    process.exit(0);
  });

// ── proto ──────────────────────────────────────────────────────────────
program
  .command("proto")
  .description("Prototype a complete module/app quickly")
  .argument("<description...>", "What are we prototyping?")
  .action(async (descWords) => {
    const prompt =
      "[PROTOTYPE MODE: Generate a complete, production-ready MVP for this] " +
      descWords.join(" ");
    await askAgent(prompt);
    process.exit(0);
  });

// ── mcp (parent command) ──────────────────────────────────────────────
const mcpCmd = program
  .command("mcp")
  .description("Manage MCP (Model Context Protocol) server configurations");

// mcp add <name>
mcpCmd
  .command("add")
  .description("Add or update an MCP server configuration")
  .argument("<name>", "Unique name for the MCP server")
  .option("--url <url>", "Server endpoint URL")
  .option("--command <cmd>", "Shell command to launch the server")
  .option("--args <args...>", "Arguments for the launch command")
  .option("--env <pairs...>", "Environment variables as KEY=VALUE pairs")
  .action((name, options) => {
    const config = loadMcpConfig();

    const entry = {};
    if (options.url) {
      entry.type = "url";
      entry.url = options.url;
    } else if (options.command) {
      entry.type = "stdio";
      entry.command = options.command;
      entry.args = options.args || [];
    } else {
      entry.type = "stdio";
      entry.command = name;
      entry.args = options.args || [];
    }

    if (options.env && options.env.length > 0) {
      entry.env = {};
      for (const pair of options.env) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx > 0) {
          entry.env[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
        }
      }
    }

    config.servers[name] = entry;
    saveMcpConfig(config);
    printSuccess(`MCP server '${name}' added successfully.`);
    console.log(chalk.gray(JSON.stringify(entry, null, 2)));
  });

// mcp remove <name>
mcpCmd
  .command("remove")
  .description("Remove an MCP server configuration")
  .argument("<name>", "Name of the MCP server to remove")
  .action((name) => {
    const config = loadMcpConfig();
    if (config.servers[name]) {
      delete config.servers[name];
      saveMcpConfig(config);
      printSuccess(`MCP server '${name}' removed.`);
    } else {
      console.log(
        chalk.yellow(`\n⚠ MCP server '${name}' not found in configuration.\n`)
      );
    }
  });

// mcp list
mcpCmd
  .command("list")
  .description("List all configured MCP servers")
  .action(() => {
    const config = loadMcpConfig();
    const names = Object.keys(config.servers);
    if (names.length === 0) {
      console.log(
        chalk.gray(
          "\nNo MCP servers configured. Use 'rgcli mcp add <name>' to add one.\n"
        )
      );
      return;
    }
    console.log(chalk.cyan.bold("\n── Configured MCP Servers ──\n"));
    for (const name of names) {
      const srv = config.servers[name];
      const typeLabel = srv.type === "url" ? chalk.blue("URL") : chalk.green("STDIO");
      const detail =
        srv.type === "url"
          ? srv.url
          : `${srv.command}${srv.args && srv.args.length > 0 ? " " + srv.args.join(" ") : ""}`;
      console.log(`  ${chalk.white.bold(name)}  ${typeLabel}  ${chalk.gray(detail)}`);
    }
    console.log("");
  });

// mcp inspect <name>
mcpCmd
  .command("inspect")
  .description("Show detailed configuration for an MCP server")
  .argument("<name>", "Name of the MCP server to inspect")
  .action((name) => {
    const config = loadMcpConfig();
    const srv = config.servers[name];
    if (!srv) {
      console.log(
        chalk.yellow(`\n⚠ MCP server '${name}' not found in configuration.\n`)
      );
      return;
    }
    console.log(chalk.cyan.bold(`\n── MCP Server: ${name} ──\n`));
    console.log(JSON.stringify(srv, null, 2));
    console.log("");
  });

// ── --config flag handler ──────────────────────────────────────────────
function handleConfigFlag() {
  const config = loadConfig();
  console.log(chalk.cyan.bold("\n── Current Configuration ──\n"));
  console.log(
    chalk.white(`  Token:     ${config.token ? chalk.green("set (" + config.token.slice(0, 12) + "…)") : chalk.red("not set")}`)
  );
  console.log(
    chalk.white(`  API URL:   ${config.apiUrl || chalk.gray("http://localhost:3000/api/cli (default)")}`)
  );
  console.log(
    chalk.white(`  Model:     ${config.model || chalk.gray("default")}`)
  );

  // Show any extra keys
  const knownKeys = new Set(["token", "apiUrl", "model"]);
  for (const [key, value] of Object.entries(config)) {
    if (!knownKeys.has(key)) {
      console.log(chalk.white(`  ${key}:  ${chalk.gray(JSON.stringify(value))}`));
    }
  }

  console.log(
    chalk.white(`\n  Config file: ${chalk.gray(path.join(os.homedir(), ".rgcli.json"))}`)
  );
  console.log(
    chalk.white(`  MCP config:  ${chalk.gray(MCP_CONFIG_PATH)}`)
  );
  console.log(
    chalk.white(`  Skills dir:  ${chalk.gray(path.join(os.homedir(), ".rgcli", "skills"))}`)
  );
  console.log(
    chalk.white(`  Sessions:    ${chalk.gray(path.join(os.homedir(), ".rgcli", "sessions"))}`)
  );
  console.log("");
}

// ── Default behaviour / entry point ────────────────────────────────────
if (process.argv.length === 2) {
  // No arguments at all → launch interactive loop
  startInteractiveLoop();
} else {
  // Check for --config before parsing (since it's a flag, not a command)
  if (process.argv.includes("--config")) {
    handleConfigFlag();
  } else {
    program.parse(process.argv);

    // After parsing, check if a known subcommand was actually invoked.
    // If not (e.g. user just passed flags like `rgcli --model groq`),
    // fall through to interactive loop.
    const userArgs = process.argv.slice(2);
    const hasSubcommand = userArgs.some((arg) => KNOWN_COMMANDS.includes(arg));

    if (!hasSubcommand) {
      startInteractiveLoop();
    }
  }
}
