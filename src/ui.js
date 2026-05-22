import boxen from "boxen";
import chalk from "chalk";
import { highlight } from "cli-highlight";
import * as Diff from "diff";

// ─────────────────────────────────────────────────────────────
//  1. renderBox — general-purpose boxen container with round border
// ─────────────────────────────────────────────────────────────
export function renderBox(title, content, color = "cyan") {
  const borderColor =
    typeof chalk[color] === "function" ? color : "cyan";

  const titleStr = title
    ? chalk[borderColor]
      ? chalk[borderColor].bold(` ${title} `)
      : chalk.cyan.bold(` ${title} `)
    : undefined;

  console.log(
    boxen(content, {
      title: titleStr,
      titleAlignment: "left",
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor,
    })
  );
}

// ─────────────────────────────────────────────────────────────
//  2. renderCodeBox — syntax-highlighted code inside a box
// ─────────────────────────────────────────────────────────────
export function renderCodeBox(filename, code, language = "javascript") {
  let highlighted;
  try {
    highlighted = highlight(code, { language, ignoreIllegals: true });
  } catch {
    // Fall back to unhighlighted code if language is unsupported
    highlighted = code;
  }

  const header = chalk.blue.dim("─".repeat(40));
  const fileLabel = chalk.blue.bold("📄 ") + chalk.blueBright.underline(filename);
  const langLabel = chalk.blue.dim(` (${language})`);
  const body = `${fileLabel}${langLabel}\n${header}\n${highlighted}`;

  console.log(
    boxen(body, {
      title: chalk.blue.bold(" Code "),
      titleAlignment: "left",
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
    })
  );
}

// ─────────────────────────────────────────────────────────────
//  3. renderDiffBox — git-style +/- diff display with colors
// ─────────────────────────────────────────────────────────────
export function renderDiffBox(filename, original, modified) {
  const diffResult = Diff.diffLines(original, modified);

  let added = 0;
  let removed = 0;
  let output = "";

  for (const part of diffResult) {
    const lines = part.value.replace(/\n$/, "").split("\n");

    if (part.added) {
      added += lines.length;
      for (const line of lines) {
        output += chalk.green.bold("+ ") + chalk.green(line) + "\n";
      }
    } else if (part.removed) {
      removed += lines.length;
      for (const line of lines) {
        output += chalk.red.bold("- ") + chalk.red(line) + "\n";
      }
    } else {
      for (const line of lines) {
        output += chalk.dim("  " + line) + "\n";
      }
    }
  }

  const stats =
    chalk.green.bold(`+${added} `) +
    chalk.red.bold(`-${removed} `) +
    chalk.dim("lines changed");

  const fileLabel = chalk.yellow.bold("📝 ") + chalk.yellowBright.underline(filename);
  const body = `${fileLabel}  ${stats}\n${chalk.yellow.dim("─".repeat(40))}\n${output.trimEnd()}`;

  console.log(
    boxen(body, {
      title: chalk.yellow.bold(" Diff "),
      titleAlignment: "left",
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "yellow",
    })
  );
}

// ─────────────────────────────────────────────────────────────
//  4. printError — red ✖ Error prefix
// ─────────────────────────────────────────────────────────────
export function printError(msg) {
  console.log(
    chalk.red.bold("\n  ✖ Error: ") + chalk.red(msg) + "\n"
  );
}

// ─────────────────────────────────────────────────────────────
//  5. printSuccess — green ✔ Success prefix
// ─────────────────────────────────────────────────────────────
export function printSuccess(msg) {
  console.log(
    chalk.green.bold("\n  ✔ Success: ") + chalk.green(msg) + "\n"
  );
}

// ─────────────────────────────────────────────────────────────
//  6. printStep — cyan ❯ prefix
// ─────────────────────────────────────────────────────────────
export function printStep(msg) {
  console.log(chalk.cyan.bold("  ❯ ") + chalk.white(msg));
}

// ─────────────────────────────────────────────────────────────
//  7. printWarning — yellow ⚠ Warning prefix
// ─────────────────────────────────────────────────────────────
export function printWarning(msg) {
  console.log(
    chalk.yellow.bold("\n  ⚠ Warning: ") + chalk.yellow(msg) + "\n"
  );
}

// ─────────────────────────────────────────────────────────────
//  8. printInfo — blue ℹ Info prefix
// ─────────────────────────────────────────────────────────────
export function printInfo(msg) {
  console.log(
    chalk.blue.bold("  ℹ ") + chalk.blueBright(msg)
  );
}

// ─────────────────────────────────────────────────────────────
//  9. printAsciiLogo — the RafayGen ASCII art logo
// ─────────────────────────────────────────────────────────────
export function printAsciiLogo() {
  const logo = `
  ${chalk.cyan.bold("╔══════════════════════════════════════════════════╗")}
  ${chalk.cyan.bold("║")}                                                  ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold(" ____        __            _____            ")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("|  _ \\      / _|          / ____|           ")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("| |_) | __ _| |_ __ _ _ _| |  __ ___ _ __  ")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("|  _ < / _` |  _/ _` | | | | |_ / _ \\ '_ \\ ")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("| |_) | (_| | || (_| | |_| |__| |  __/ | | |")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("|____/ \\__,_|_| \\__,_|\\__, \\_____\\___|_| |_|")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("                       __/ |                ")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}   ${chalk.cyanBright.bold("                      |___/                 ")}   ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}                                                  ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}     ${chalk.dim.white("AI-Powered Code Generation & Dev Agent")}       ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("║")}                                                  ${chalk.cyan.bold("║")}
  ${chalk.cyan.bold("╚══════════════════════════════════════════════════╝")}
`;
  console.log(logo);
}

// ─────────────────────────────────────────────────────────────
// 10. printRandomWelcome — random welcome message from array
// ─────────────────────────────────────────────────────────────
export function printRandomWelcome() {
  const messages = [
    "Welcome to RafayGen. Ready to architect something beautiful?",
    "RafayGen Agent initialized. Standing by for instructions.",
    "Authentication successful. Let's write some code.",
    "System online. Awaiting your creative vision.",
    "RafayGen connected. What are we building today?",
    "Agent is active. Drop your prompt below.",
    "Neural pathways connected. Let's create something extraordinary.",
    "All systems nominal. Your AI coding partner is ready.",
  ];

  const colors = [
    "green",
    "cyan",
    "magenta",
    "blueBright",
    "greenBright",
    "yellowBright",
    "cyanBright",
    "magentaBright",
  ];

  const idx = Math.floor(Math.random() * messages.length);
  const colorIdx = Math.floor(Math.random() * colors.length);
  const colorFn = chalk[colors[colorIdx]] || chalk.cyan;

  console.log(colorFn.bold(`\n  ✨ ${messages[idx]}\n`));
}

// ─────────────────────────────────────────────────────────────
// 11. printModelBadge — shows current active model in a badge
// ─────────────────────────────────────────────────────────────
export function printModelBadge(model) {
  if (!model) return;

  const badge =
    chalk.bgMagenta.white.bold(" MODEL ") +
    chalk.bgBlack.magentaBright.bold(` ${model} `);

  console.log(`\n  ${badge}\n`);
}

// ─────────────────────────────────────────────────────────────
// 12. printSessionStatus — full session status display
// ─────────────────────────────────────────────────────────────
export function printSessionStatus(state = {}) {
  const {
    model = "unknown",
    sandbox = false,
    approval = "auto",
    cwd = process.cwd(),
    reasoning = false,
    attachedFiles = 0,
    sessionId = null,
  } = state;

  const statusIndicator = chalk.green.bold("●");
  const lines = [];

  lines.push(
    chalk.bold.white("  Session Status") + chalk.dim("  ─────────────────────────")
  );
  lines.push("");

  // Model
  lines.push(
    `  ${chalk.dim("Model:")}       ${chalk.magentaBright.bold(model)}`
  );

  // Session ID
  if (sessionId) {
    lines.push(
      `  ${chalk.dim("Session:")}     ${chalk.white(sessionId)}`
    );
  }

  // Sandbox
  const sandboxBadge = sandbox
    ? chalk.bgGreen.black.bold(" ON ") + chalk.green(" Sandboxed")
    : chalk.bgRed.white.bold(" OFF ") + chalk.red(" Direct");
  lines.push(`  ${chalk.dim("Sandbox:")}     ${sandboxBadge}`);

  // Approval mode
  const approvalBadge =
    approval === "auto"
      ? chalk.bgYellow.black.bold(` ${approval.toUpperCase()} `)
      : chalk.bgBlue.white.bold(` ${approval.toUpperCase()} `);
  lines.push(`  ${chalk.dim("Approval:")}    ${approvalBadge}`);

  // CWD
  lines.push(
    `  ${chalk.dim("Working Dir:")} ${chalk.blueBright(cwd)}`
  );

  // Reasoning
  const reasonBadge = reasoning
    ? chalk.green.bold("✔ enabled")
    : chalk.dim("✘ disabled");
  lines.push(`  ${chalk.dim("Reasoning:")}   ${reasonBadge}`);

  // Attached files
  lines.push(
    `  ${chalk.dim("Attached:")}    ${chalk.white.bold(String(attachedFiles))} file${attachedFiles !== 1 ? "s" : ""}`
  );

  lines.push("");
  lines.push(`  ${statusIndicator} ${chalk.green("Active")}`);

  console.log(
    boxen(lines.join("\n"), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: chalk.cyan.bold(" ⚡ Session "),
      titleAlignment: "left",
    })
  );
}

// ─────────────────────────────────────────────────────────────
// 13. renderMarkdown — basic markdown → terminal rendering
// ─────────────────────────────────────────────────────────────
export function renderMarkdown(text) {
  if (!text) return "";

  let output = text;

  // ── Fenced code blocks: ```lang\ncode\n``` ──────────────
  output = output.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_match, lang, code) => {
      let highlighted;
      try {
        highlighted = highlight(code.trimEnd(), {
          language: lang || "plaintext",
          ignoreIllegals: true,
        });
      } catch {
        highlighted = code.trimEnd();
      }
      const border = chalk.dim("│ ");
      const styledCode = highlighted
        .split("\n")
        .map((l) => `  ${border}${l}`)
        .join("\n");
      const label = lang ? chalk.dim.italic(` ${lang} `) : "";
      return `\n  ${chalk.dim("┌──")}${label}${chalk.dim("──")}\n${styledCode}\n  ${chalk.dim("└──────")}\n`;
    }
  );

  // ── Inline code: `code` ────────────────────────────────
  output = output.replace(
    /`([^`]+)`/g,
    (_match, code) => chalk.bgGray.white(` ${code} `)
  );

  // ── Headers: # ## ### ──────────────────────────────────
  output = output.replace(
    /^### (.+)$/gm,
    (_match, heading) => chalk.cyan.bold(`    ${heading}`)
  );
  output = output.replace(
    /^## (.+)$/gm,
    (_match, heading) => chalk.cyan.bold.underline(`  ${heading}`)
  );
  output = output.replace(
    /^# (.+)$/gm,
    (_match, heading) => "\n" + chalk.cyanBright.bold.underline(`${heading}`) + "\n"
  );

  // ── Bold: **text** ─────────────────────────────────────
  output = output.replace(
    /\*\*([^*]+)\*\*/g,
    (_match, bold) => chalk.bold(bold)
  );

  // ── Italic: *text* or _text_ ───────────────────────────
  output = output.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    (_match, it) => chalk.italic(it)
  );
  output = output.replace(
    /(?<!_)_([^_]+)_(?!_)/g,
    (_match, it) => chalk.italic(it)
  );

  // ── Unordered list: - item or * item ───────────────────
  output = output.replace(
    /^(\s*)[-*] (.+)$/gm,
    (_match, indent, item) => `${indent}  ${chalk.cyan("•")} ${item}`
  );

  // ── Ordered list: 1. item ──────────────────────────────
  output = output.replace(
    /^(\s*)(\d+)\. (.+)$/gm,
    (_match, indent, num, item) =>
      `${indent}  ${chalk.cyan(num + ".")} ${item}`
  );

  // ── Blockquote: > text ─────────────────────────────────
  output = output.replace(
    /^> (.+)$/gm,
    (_match, quote) => chalk.dim(`  ${chalk.green("▎")} ${chalk.italic(quote)}`)
  );

  // ── Horizontal rule: --- or *** ────────────────────────
  output = output.replace(
    /^(---|===|\*\*\*)$/gm,
    () => chalk.dim("  " + "─".repeat(50))
  );

  // ── Links: [text](url) ────────────────────────────────
  output = output.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, url) => chalk.blue.underline(label) + chalk.dim(` (${url})`)
  );

  console.log(output);
  return output;
}

// ─────────────────────────────────────────────────────────────
// 14. printAgentThinking — renders thinking/reasoning text
// ─────────────────────────────────────────────────────────────
export function printAgentThinking(text) {
  if (!text) return;

  const lines = text.split("\n");
  const prefix = chalk.dim.italic("  💭 ");
  const border = chalk.dim.italic("  │  ");

  console.log("");
  console.log(prefix + chalk.dim.italic("Thinking..."));
  for (const line of lines) {
    console.log(border + chalk.dim.italic(line));
  }
  console.log(chalk.dim.italic("  └──"));
  console.log("");
}

// ─────────────────────────────────────────────────────────────
// 15. printToolExecution — renders a tool call in styled box
// ─────────────────────────────────────────────────────────────
export function printToolExecution(toolName, args = {}) {
  const header =
    chalk.bgYellow.black.bold(" TOOL ") +
    " " +
    chalk.yellowBright.bold(toolName);

  const argLines = [];
  const entries = Object.entries(args);

  if (entries.length > 0) {
    for (const [key, value] of entries) {
      let displayValue;
      if (typeof value === "string") {
        // Truncate very long strings
        displayValue =
          value.length > 120
            ? chalk.white(`"${value.slice(0, 117)}..."`)
            : chalk.white(`"${value}"`);
      } else if (typeof value === "object" && value !== null) {
        const jsonStr = JSON.stringify(value);
        displayValue =
          jsonStr.length > 120
            ? chalk.dim(jsonStr.slice(0, 117) + "...")
            : chalk.dim(jsonStr);
      } else {
        displayValue = chalk.yellowBright(String(value));
      }

      argLines.push(`  ${chalk.cyan(key)}${chalk.dim(":")} ${displayValue}`);
    }
  } else {
    argLines.push(chalk.dim("  (no arguments)"));
  }

  const body = `${header}\n\n${argLines.join("\n")}`;

  console.log(
    boxen(body, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 2, right: 0 },
      borderStyle: "round",
      borderColor: "yellow",
      dimBorder: true,
    })
  );
}
