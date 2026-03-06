import { NextResponse } from "next/server";
import { loadToken } from "@/lib/claude-token";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = loadToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(USAGE_ENDPOINT, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    return NextResponse.json({ error: "Session expired — please sign in again" }, { status: 401 });
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    return NextResponse.json({ error: "Rate limited", retryAfter }, { status: 429 });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[claude-usage] Anthropic API error ${res.status}:`, body);
    return NextResponse.json({ error: `Anthropic API error: HTTP ${res.status}`, detail: body }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
