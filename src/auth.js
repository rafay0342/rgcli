import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_PATH = path.join(os.homedir(), ".rgcli.json");

export function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }
  return {};
}

export function saveConfig(config) {
  const existing = loadConfig();
  const updated = { ...existing, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
}

export function getToken() {
  return loadConfig().token;
}

export function setToken(token) {
  saveConfig({ token });
}

export function getApiUrl() {
  // Default to localhost for local testing, can be overridden by environment variable or config
  return process.env.RG_API_URL || loadConfig().apiUrl || "http://localhost:3000/api/cli";
}

export function setApiUrl(apiUrl) {
  saveConfig({ apiUrl });
}
