import { readFileSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TOKEN_FILE = path.join(DATA_DIR, "claude-oauth-token");

export function loadToken(): string | null {
  try {
    if (!existsSync(TOKEN_FILE)) return null;
    const t = readFileSync(TOKEN_FILE, "utf-8").trim();
    return t || null;
  } catch { return null; }
}
