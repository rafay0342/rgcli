import { getToken, getApiUrl } from "./auth.js";
import { renderBox, renderDiffBox, printError, printStep, printSuccess } from "./ui.js";
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

export async function askAgent(promptText) {
  const token = getToken();
  if (!token) {
    printError("Not logged in. Please run 'rgcli login <token>' first.");
    process.exit(1);
  }

  printStep("Connecting to RafayGen...");

  try {
    const res = await fetch(getApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ prompt: promptText })
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.statusText}`);
    }

    // Since this is a simple implementation, we'll read the full JSON response.
    // In a fully streaming CLI, you'd parse the stream.
    const data = await res.json();
    
    if (data.message) {
      renderBox(" RafayGen ", data.message, "cyan");
    }

    if (data.actions && data.actions.length > 0) {
      for (const action of data.actions) {
        await handleAction(action);
      }
    } else {
      printSuccess("Done.");
    }

  } catch (error) {
    printError(error.message);
  }
}

async function handleAction(action) {
  if (action.type === "write") {
    const filepath = path.resolve(process.cwd(), action.file);
    let original = "";
    if (fs.existsSync(filepath)) {
      original = fs.readFileSync(filepath, "utf-8");
    }

    // Show diff
    renderDiffBox(action.file, original, action.content);

    // Ask user to confirm
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Allow RafayGen to write to ${action.file}?`,
        default: true
      }
    ]);

    if (confirm) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, action.content, "utf-8");
      printSuccess(`Saved ${action.file}`);
    } else {
      console.log(chalk.yellow("Skipped write."));
    }
  } else if (action.type === "execute") {
    renderBox(` Execute Command `, action.command, "magenta");
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Allow RafayGen to execute this command?`,
        default: true
      }
    ]);

    if (confirm) {
      await new Promise((resolve) => {
        const proc = exec(action.command, (err, stdout, stderr) => {
          if (stdout) console.log(chalk.gray(stdout));
          if (stderr) console.log(chalk.red(stderr));
          if (err) printError(`Command failed with code ${err.code}`);
          else printSuccess("Command executed successfully.");
          resolve();
        });
      });
    }
  }
}
