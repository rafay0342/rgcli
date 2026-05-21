#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { setToken, setApiUrl } from "../src/auth.js";
import { askAgent } from "../src/agent.js";
import { printSuccess } from "../src/ui.js";
import fs from "fs";

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const program = new Command();

program
  .name("rgcli")
  .description("RafayGen - The Ultimate Agentic Coding CLI")
  .version(pkg.version);

program
  .command("login")
  .description("Authenticate with your RafayGen live app")
  .argument("<token>", "Your Personal Access Token")
  .option("--url <url>", "Set custom API URL (e.g. http://localhost:3000/api/cli)")
  .action((token, options) => {
    setToken(token);
    if (options.url) {
      setApiUrl(options.url);
    }
    printSuccess("Successfully logged in to RafayGen!");
  });

program
  .command("ask")
  .description("Ask RafayGen to write code, modify files, or run commands")
  .argument("<prompt...>", "What do you want to build?")
  .action((promptWords) => {
    const prompt = promptWords.join(" ");
    askAgent(prompt);
  });

// Handle default command if no args provided
if (process.argv.length === 2) {
  console.log(chalk.cyan.bold(`
  ____        __            _____            
 |  _ \\      / _|          / ____|           
 | |_) | __ _| |_ __ _ _ _| |  __ ___ _ __  
 |  _ < / _\` |  _/ _\` | | | | |_ / _ \\ '_ \\ 
 | |_) | (_| | || (_| | |_| |__| |  __/ | | |
 |____/ \\__,_|_| \\__,_|\\__, \\_____\\___|_| |_|
                        __/ |                
                       |___/                 
`));
  program.help();
}

program.parse(process.argv);
