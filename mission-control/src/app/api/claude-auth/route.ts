import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import path from "path";
import { loadToken } from "@/lib/claude-token";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TOKEN_FILE = path.join(DATA_DIR, "claude-oauth-token");
const STATE_FILE = path.join(DATA_DIR, "claude-oauth-state.json");

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const TOKEN_ENDPOINT = "https://console.anthropic.com/v1/oauth/token";
const AUTH_URL = "https://claude.ai/oauth/authorize";
const SCOPE = "user:profile user:inference";

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ─── Token Storage ────────────────────────────────────────────────────────────

function saveToken(token: string) {
  writeFileSync(TOKEN_FILE, token, { encoding: "utf-8", mode: 0o600 });
}

function deleteToken() {
  try { if (existsSync(TOKEN_FILE)) unlinkSync(TOKEN_FILE); } catch { /* best effort */ }
}

// ─── PKCE State Storage ───────────────────────────────────────────────────────

function saveOAuthState(verifier: string, state: string) {
  writeFileSync(STATE_FILE, JSON.stringify({ verifier, state }), { encoding: "utf-8", mode: 0o600 });
}

function loadOAuthState(): { verifier: string; state: string } | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch { return null; }
}

function deleteOAuthState() {
  try { if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE); } catch { /* best effort */ }
}

// ─── GET: Auth status ─────────────────────────────────────────────────────────

export async function GET() {
  const token = loadToken();
  return NextResponse.json({ authenticated: !!token });
}

// ─── POST: start | exchange | signout ─────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json() as { action: string; code?: string };

  // ── Start OAuth flow ──────────────────────────────────────────────────────
  if (body.action === "start") {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = generateCodeVerifier();

    saveOAuthState(verifier, state);

    const params = new URLSearchParams({
      code: "true",
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

    return NextResponse.json({ url: `${AUTH_URL}?${params.toString()}` });
  }

  // ── Exchange code for token ───────────────────────────────────────────────
  if (body.action === "exchange") {
    if (!body.code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const pkce = loadOAuthState();
    if (!pkce) {
      return NextResponse.json({ error: "No pending OAuth flow — start again" }, { status: 400 });
    }

    // Code format from Anthropic redirect page: "code#state"
    const parts = body.code.trim().split("#");
    const code = parts[0];
    const returnedState = parts[1];

    if (returnedState && returnedState !== pkce.state) {
      deleteOAuthState();
      return NextResponse.json({ error: "OAuth state mismatch — try again" }, { status: 400 });
    }

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        state: pkce.state,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: pkce.verifier,
      }),
    });

    deleteOAuthState();

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Token exchange failed: HTTP ${res.status} — ${text}` },
        { status: 502 }
      );
    }

    const json = await res.json() as { access_token?: string };
    if (!json.access_token) {
      return NextResponse.json({ error: "No access_token in response" }, { status: 502 });
    }

    saveToken(json.access_token);
    return NextResponse.json({ success: true });
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  if (body.action === "signout") {
    deleteToken();
    deleteOAuthState();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
