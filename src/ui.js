import boxen from "boxen";
import chalk from "chalk";
import { highlight } from "cli-highlight";
import * as Diff from "diff";
import fs from "fs";
import path from "path";

// Formats a message in a nice outlined box
export function renderBox(title, content, color = "cyan") {
  const c = chalk[color] || chalk.cyan;
  console.log(
    boxen(content, {
      title: c.bold(title),
      titleAlignment: "left",
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: color,
    })
  );
}

// Renders syntax highlighted code in a box
export function renderCodeBox(filename, code, language = "typescript") {
  const highlighted = highlight(code, {
    language,
    ignoreIllegals: true,
  });
  renderBox(` File: ${filename} `, highlighted, "blue");
}

// Renders a git-like diff for code modifications
export function renderDiffBox(filename, original, modified) {
  const diffResult = Diff.diffLines(original, modified);
  let output = "";
  
  diffResult.forEach((part) => {
    // Add prefix and color based on diff status
    let prefix = "  ";
    let colorize = chalk.dim;
    
    if (part.added) {
      prefix = chalk.green("+ ");
      colorize = chalk.green;
    } else if (part.removed) {
      prefix = chalk.red("- ");
      colorize = chalk.red;
    }

    // Split part into lines and format
    const lines = part.value.replace(/\n$/, "").split("\n");
    lines.forEach((line) => {
      output += colorize(`${prefix}${line}`) + "\n";
    });
  });

  renderBox(` Diff: ${filename} `, output.trimEnd(), "yellow");
}

export function printError(msg) {
  console.log(chalk.red.bold("\n✖ Error: ") + chalk.red(msg) + "\n");
}

export function printSuccess(msg) {
  console.log(chalk.green.bold("\n✔ Success: ") + chalk.green(msg) + "\n");
}

export function printStep(msg) {
  console.log(chalk.cyan.bold("❯ ") + msg);
}
