import fs from "fs";
import path from "path";
import os from "os";
import chalk from "chalk";
import inquirer from "inquirer";
import open from "open";
import http from "http";

// ─── Paths ──────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(os.homedir(), ".rgcli.json");
const RGCLI_DIR = path.join(os.homedir(), ".rgcli");
const SESSIONS_DIR = path.join(RGCLI_DIR, "sessions");
const SKILLS_DIR = path.join(RGCLI_DIR, "skills");
const MCP_CONFIG_PATH = path.join(RGCLI_DIR, "mcp.json");

const DEFAULT_API_URL = "http://localhost:3000/api/cli";

// ─── 1. loadConfig / saveConfig ─────────────────────────────────────────────────

/**
 * Reads the entire ~/.rgcli.json config file.
 * Returns an empty object if the file doesn't exist or is malformed.
 */
export function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Merges the given partial config into the existing ~/.rgcli.json and writes it.
 * Creates the file if it doesn't exist.
 */
export function saveConfig(partial) {
  const existing = loadConfig();
  const merged = { ...existing, ...partial };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

// ─── 2. getToken / setToken ─────────────────────────────────────────────────────

/**
 * Returns the stored authentication token, or undefined if not set.
 * Checks the RG_TOKEN env var first, then the config file.
 */
export function getToken() {
  if (process.env.RG_TOKEN) {
    return process.env.RG_TOKEN;
  }
  return loadConfig().token;
}

/**
 * Persists the authentication token into ~/.rgcli.json.
 */
export function setToken(token) {
  saveConfig({ token });
}

// ─── 3. getApiUrl / setApiUrl ───────────────────────────────────────────────────

/**
 * Returns the API URL.
 * Priority: RG_API_URL env var → config file → default.
 */
export function getApiUrl() {
  if (process.env.RG_API_URL) {
    return process.env.RG_API_URL;
  }
  return loadConfig().apiUrl || DEFAULT_API_URL;
}

/**
 * Persists the API URL into ~/.rgcli.json.
 */
export function setApiUrl(apiUrl) {
  saveConfig({ apiUrl });
}

// ─── 4. getModel / setModel ─────────────────────────────────────────────────────

/**
 * Returns the currently selected model name.
 * Priority: RG_MODEL env var → config file → "default".
 */
export function getModel() {
  if (process.env.RG_MODEL) {
    return process.env.RG_MODEL;
  }
  return loadConfig().model || "default";
}

/**
 * Persists the selected model name into ~/.rgcli.json.
 */
export function setModel(model) {
  saveConfig({ model });
}

// ─── 5. getProfile / setProfile ─────────────────────────────────────────────────

/**
 * Returns the stored user profile object, or null if not set.
 * Profile shape: { name, email, avatar }
 */
export function getProfile() {
  const config = loadConfig();
  return config.profile || null;
}

/**
 * Persists the user profile object into ~/.rgcli.json.
 * @param {object} profile — { name?: string, email?: string, avatar?: string }
 */
export function setProfile(profile) {
  saveConfig({ profile });
}

// ─── 6. clearConfig — Logout ────────────────────────────────────────────────────

/**
 * Completely wipes the authentication token and profile from the config.
 * Keeps other settings (apiUrl, model, etc.) intact.
 */
export function clearConfig() {
  const config = loadConfig();
  delete config.token;
  delete config.profile;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ─── 8. getSessionDir ───────────────────────────────────────────────────────────

/**
 * Returns the path to ~/.rgcli/sessions/.
 * Creates the directory tree if it doesn't already exist.
 */
export function getSessionDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  return SESSIONS_DIR;
}

// ─── 9. getMcpConfigPath ────────────────────────────────────────────────────────

/**
 * Returns the path to ~/.rgcli/mcp.json.
 * Ensures the parent directory exists, and creates an empty JSON object file
 * if the file doesn't exist yet.
 */
export function getMcpConfigPath() {
  if (!fs.existsSync(RGCLI_DIR)) {
    fs.mkdirSync(RGCLI_DIR, { recursive: true });
  }
  if (!fs.existsSync(MCP_CONFIG_PATH)) {
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify({}, null, 2), "utf-8");
  }
  return MCP_CONFIG_PATH;
}

// ─── 10. getSkillsDir ──────────────────────────────────────────────────────────

/**
 * Returns the path to ~/.rgcli/skills/.
 * Creates the directory tree if it doesn't already exist.
 */
export function getSkillsDir() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
  return SKILLS_DIR;
}

// ─── 7. startAuthLoop — Interactive Authentication ──────────────────────────────

/**
 * Launches an interactive authentication loop with three methods:
 *   a) Browser Login — Google OAuth via a localhost callback server on port 8080
 *   b) Paste Token Manually — password input prompt
 *   c) Device Code — generate a 6-digit code, show verification URL, then paste token
 *
 * All methods store the token via setToken() and print a success message.
 * The loop re-prompts on failure until the user authenticates or exits.
 */
export async function startAuthLoop() {
  const { printAsciiLogo, printSuccess, printError } = await import("./ui.js");

  printAsciiLogo();
  console.log(
    chalk.yellow("You are not logged in. Let's get you authenticated!\n")
  );

  while (true) {
    const { method } = await inquirer.prompt([
      {
        type: "list",
        name: "method",
        message: "How would you like to login to RafayGen?",
        choices: [
          { name: `${chalk.green("●")} Browser Login (Recommended)`, value: "browser" },
          { name: `${chalk.yellow("●")} Paste Token Manually`, value: "token" },
          { name: `${chalk.magenta("●")} Device Code (Headless)`, value: "device" },
          { name: `${chalk.red("●")} Exit CLI`, value: "exit" },
        ],
      },
    ]);

    // ── Exit ────────────────────────────────────────────────────────────────
    if (method === "exit") {
      console.log(chalk.gray("Goodbye.\n"));
      process.exit(0);
    }

    // ── Method B: Paste Token Manually ──────────────────────────────────────
    if (method === "token") {
      try {
        const { token } = await inquirer.prompt([
          {
            type: "password",
            name: "token",
            mask: "*",
            message: "Paste your RafayGen Personal Access Token:",
            validate: (input) =>
              input.trim().length > 0 ? true : "Token cannot be empty.",
          },
        ]);

        const trimmed = token.trim();
        setToken(trimmed);
        printSuccess("Successfully logged in to RafayGen!");
        return;
      } catch (err) {
        printError(`Token input failed: ${err.message}`);
        continue;
      }
    }

    // ── Method A: Browser Login (Google OAuth) ──────────────────────────────
    if (method === "browser") {
      const CALLBACK_PORT = 8080;
      const CLIENT_ID =
        "580872142938-2k11f1ced5749euggkqquj5quch0tf43.apps.googleusercontent.com";
      const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
      const SCOPES = "email profile";
      const loginUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(SCOPES)}`;

      console.log(chalk.cyan("\nSpinning up local authentication server..."));
      console.log(
        chalk.gray(
          `Listening for Google OAuth callback on port ${CALLBACK_PORT}...`
        )
      );

      const callbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RafayGen — Authenticating</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; margin: 0;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.07); backdrop-filter: blur(12px);
      border-radius: 16px; padding: 48px 40px; text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); max-width: 420px;
    }
    h2 { margin: 0 0 12px; font-size: 1.5em; }
    p  { margin: 0; opacity: 0.8; font-size: 0.95em; }
    .success h2 { color: #4ade80; }
    .error   h2 { color: #f87171; }
    .spinner {
      width: 40px; height: 40px; margin: 0 auto 20px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #60a5fa; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="spinner" id="spinner"></div>
    <h2 id="title">Authenticating…</h2>
    <p id="msg">Please wait while we verify your identity.</p>
  </div>
  <script>
    (function() {
      var hash = window.location.hash.substring(1);
      var params = new URLSearchParams(hash);
      var accessToken = params.get("access_token");
      var card  = document.getElementById("card");
      var title = document.getElementById("title");
      var msg   = document.getElementById("msg");
      var spin  = document.getElementById("spinner");

      if (accessToken) {
        fetch("/token", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: accessToken
        })
        .then(function(res) {
          spin.style.display = "none";
          if (res.ok) {
            card.className = "card success";
            title.textContent = "Authentication Successful!";
            msg.textContent  = "You may close this tab and return to the CLI.";
          } else {
            card.className = "card error";
            title.textContent = "Authentication Failed";
            msg.textContent  = "The server rejected the token. Please try again.";
          }
        })
        .catch(function() {
          spin.style.display = "none";
          card.className = "card error";
          title.textContent = "Network Error";
          msg.textContent  = "Could not reach the local server.";
        });
      } else {
        spin.style.display = "none";
        card.className = "card error";
        title.textContent = "No Token Received";
        msg.textContent  = "Google did not return an access token. Please try again.";
      }
    })();
  </script>
</body>
</html>`;

      try {
        await new Promise((resolve, reject) => {
          let settled = false;

          const server = http.createServer((req, res) => {
            // ── Callback page ───────────────────────────────────────────
            if (req.url && req.url.startsWith("/callback")) {
              res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
              });
              res.end(callbackHtml);
              return;
            }

            // ── Token receiver ──────────────────────────────────────────
            if (req.url === "/token" && req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk.toString();
              });
              req.on("end", () => {
                const receivedToken = body.trim();
                if (receivedToken.length === 0) {
                  res.writeHead(400);
                  res.end("Empty token");
                  return;
                }
                setToken(receivedToken);
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("OK");
                printSuccess("Successfully logged in via Google OAuth!");
                settled = true;
                server.close(() => resolve());
              });
              return;
            }

            // ── Anything else ───────────────────────────────────────────
            res.writeHead(404);
            res.end("Not Found");
          });

          server.on("error", (err) => {
            if (!settled) {
              settled = true;
              if (err.code === "EADDRINUSE") {
                printError(
                  `Port ${CALLBACK_PORT} is already in use. Close whatever is using it and try again.`
                );
              } else {
                printError(`Could not start auth server: ${err.message}`);
              }
              reject(err);
            }
          });

          // 5-minute timeout so it doesn't hang forever
          const timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              printError(
                "Browser login timed out after 5 minutes. Please try again."
              );
              server.close(() => reject(new Error("Timeout")));
            }
          }, 5 * 60 * 1000);

          server.listen(CALLBACK_PORT, async () => {
            console.log(chalk.cyan("Opening browser to Google Login..."));
            try {
              await open(loginUrl);
            } catch {
              console.log(
                chalk.yellow(
                  `Could not open browser automatically.\nPlease open this URL manually:\n`
                )
              );
              console.log(chalk.underline.blueBright(loginUrl) + "\n");
            }
          });

          // Clean up timeout when server closes normally
          server.on("close", () => clearTimeout(timeout));
        });

        return; // auth successful
      } catch {
        // Server error or timeout — loop back to method selection
        console.log(
          chalk.gray("Returning to login method selection...\n")
        );
        continue;
      }
    }

    // ── Method C: Device Code ─────────────────────────────────────────────
    if (method === "device") {
      const deviceCode = String(
        Math.floor(100000 + Math.random() * 900000)
      );
      const verificationUrl = "https://rafaygen.com/device";

      console.log("");
      console.log(
        chalk.bgMagenta.white.bold("  DEVICE CODE  ") +
          "  " +
          chalk.magenta.bold(deviceCode)
      );
      console.log("");
      console.log(
        chalk.white("  1. Open ") +
          chalk.underline.blueBright(verificationUrl) +
          chalk.white(" on any device.")
      );
      console.log(
        chalk.white("  2. Enter the code ") +
          chalk.magenta.bold(deviceCode) +
          chalk.white(" when prompted.")
      );
      console.log(
        chalk.white(
          "  3. Approve the login, then paste the resulting token below."
        )
      );
      console.log("");

      // Attempt to open the verification URL in the browser automatically
      try {
        await open(verificationUrl);
        console.log(
          chalk.gray("  (Opened verification page in your default browser)\n")
        );
      } catch {
        console.log(
          chalk.gray(
            "  (Could not open browser — please navigate there manually)\n"
          )
        );
      }

      try {
        const { token } = await inquirer.prompt([
          {
            type: "password",
            name: "token",
            mask: "*",
            message:
              "After approving the device code, paste the token you received:",
            validate: (input) =>
              input.trim().length > 0 ? true : "Token cannot be empty.",
          },
        ]);

        const trimmed = token.trim();
        setToken(trimmed);
        printSuccess("Successfully logged in via Device Code!");
        return;
      } catch (err) {
        printError(`Device code login failed: ${err.message}`);
        continue;
      }
    }
  }
}
