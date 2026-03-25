/**
 * Service Connection Test API
 *
 * POST /api/field-ops/services/test
 *
 * Tests a saved service by:
 * 1. Resolving the service and its adapter
 * 2. Decrypting the stored credential from the vault
 * 3. Validating credential format via the adapter's simplest operation
 * 4. For Ethereum: additionally calls read-balance (free, no side effects)
 *
 * Returns { valid, serviceId, adapterName, details, checkedAt }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getFieldServices, getFieldCredentials } from "@/lib/data";
import { decryptCredential, verifyMasterPassword } from "@/lib/vault-crypto";
import * as vaultSession from "@/lib/vault-session";
import { getAdapter } from "@/lib/adapters/registry";
import { addFieldActivityEvent } from "@/lib/field-ops-activity";

// Import adapters so they self-register
import "@/lib/adapters/twitter-adapter";
import "@/lib/adapters/ethereum-adapter";
import "@/lib/adapters/reddit-adapter";
import "@/lib/adapters/linkedin-adapter";
import "@/lib/adapters/stripe-adapter";

export const dynamic = "force-dynamic";

const testSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  masterPassword: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  // ── 1. Parse and validate request ──
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { serviceId, masterPassword } = parsed.data;
  const checkedAt = new Date().toISOString();

  // ── 2. Resolve service ──
  const servicesData = await getFieldServices();
  const service = servicesData.services.find((s) => s.id === serviceId);

  if (!service) {
    return NextResponse.json({ error: `Service "${serviceId}" not found` }, { status: 404 });
  }

  // ── 3. Resolve adapter ──
  const adapter =
    getAdapter(service.id) ??
    (service.catalogId ? getAdapter(service.catalogId) : undefined);

  if (!adapter) {
    // No adapter — can only confirm service is saved
    return NextResponse.json({
      valid: true,
      serviceId,
      adapterName: null,
      details: "Service is saved. No automated adapter available for connection testing.",
      checkedAt,
    });
  }

  // ── 4. Check credentials exist ──
  if (!service.credentialId) {
    return NextResponse.json({
      valid: false,
      serviceId,
      adapterName: adapter.name,
      details: "No credentials stored for this service. Add credentials in the Vault first.",
      checkedAt,
    });
  }

  // ── 5. Resolve master password ──
  const password = vaultSession.getPassword() ?? masterPassword ?? null;
  if (!password) {
    return NextResponse.json(
      { error: "Vault is locked. Provide masterPassword or unlock the vault session first." },
      { status: 401 },
    );
  }

  // ── 6. Load and verify vault ──
  const credData = await getFieldCredentials();

  if (!vaultSession.isActive()) {
    if (!credData.masterKeyHash) {
      return NextResponse.json({ error: "Vault not initialized" }, { status: 400 });
    }
    const valid = verifyMasterPassword(password, credData.masterKeyHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid master password" }, { status: 403 });
    }
  }

  const credential = credData.credentials.find((c) => c.id === service.credentialId);
  if (!credential) {
    return NextResponse.json(
      { error: `Credential "${service.credentialId}" not found in vault` },
      { status: 400 },
    );
  }

  if (!credData.masterKeySalt) {
    return NextResponse.json({ error: "Vault encryption salt missing" }, { status: 500 });
  }

  // ── 7. Decrypt credential ──
  let credentials: Record<string, unknown>;
  try {
    const salt = Buffer.from(credData.masterKeySalt, "hex");
    const plaintext = decryptCredential(
      credential.encryptedData,
      credential.iv,
      credential.authTag,
      password,
      salt,
    );
    try {
      credentials = JSON.parse(plaintext) as Record<string, unknown>;
    } catch {
      credentials = { raw: plaintext };
    }
  } catch {
    return NextResponse.json(
      {
        valid: false,
        serviceId,
        adapterName: adapter.name,
        details: "Credential decryption failed — vault may be corrupted or password changed.",
        checkedAt,
      },
      { status: 200 },
    );
  }

  // ── 8. Run health check via adapter ──
  try {
    // Merge plaintext config (e.g. apiKey) with vault-decrypted secrets
    const merged = { ...service.config, ...credentials };
    const result = await adapter.healthCheck(service, merged);

    await logTest(serviceId, adapter.name, result.ok, result.message);

    return NextResponse.json({
      valid: result.ok,
      serviceId,
      adapterName: adapter.name,
      details: result.message,
      latencyMs: result.latencyMs,
      data: result.details ?? null,
      apiResponseCode: result.apiResponseCode ?? null,
      checkedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Health check error";
    await logTest(serviceId, adapter.name, false, msg);
    return NextResponse.json({
      valid: false,
      serviceId,
      adapterName: adapter.name,
      details: `Health check error: ${msg}`,
      checkedAt,
    });
  }
}

// ─── Activity Logging ────────────────────────────────────────────────────────

async function logTest(
  serviceId: string,
  adapterName: string,
  passed: boolean,
  details: string,
): Promise<void> {
  try {
    await addFieldActivityEvent({
      type: passed ? "field_task_executing" : "field_task_failed",
      actor: "me",
      taskId: null,
      serviceId,
      missionId: null,
      summary: `Connection test ${passed ? "passed" : "failed"}: ${adapterName}`,
      details,
    });
  } catch {
    // Non-fatal — don't fail the test response if logging fails
  }
}
