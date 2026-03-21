/**
 * Field Ops Task Execution API
 *
 * POST /api/field-ops/execute
 *
 * Orchestrates the full execution lifecycle:
 * 1. Validate task exists and status is "approved"
 * 2. Transition to "executing"
 * 3. Resolve service and adapter
 * 4. Validate payload
 * 5. Decrypt credentials from vault
 * 6. Execute via adapter
 * 7. Update task with result (completed/failed)
 * 8. Log activity + check circuit breaker
 */

import { NextResponse } from "next/server";
import {
  getFieldTasks,
  getFieldServices,
  getFieldCredentials,
  mutateFieldTasks,
  mutateFieldServices,
  mutateFieldMissions,
  mutateTasks,
  mutateInbox,
  getSafetyLimits,
  mutateSafetyLimits,
} from "@/lib/data";
import { validateBody, executeTaskSchema } from "@/lib/validations";
import {
  isValidTransition,
  shouldTripCircuitBreaker,
  executionRateLimiter,
} from "@/lib/field-ops-security";
import { decryptCredential, verifyMasterPassword } from "@/lib/vault-crypto";
import * as vaultSession from "@/lib/vault-session";
import { getAdapter } from "@/lib/adapters/registry";
import { addFieldActivityEvent } from "@/lib/field-ops-activity";
import {
  notifyFieldTaskCompleted,
  notifyFieldTaskFailed,
  logFieldOpsActivity,
} from "@/lib/field-ops-notify";
import { checkSpendLimits, pruneSpendLog } from "@/lib/spend-tracker";
import { generateId } from "@/lib/utils";
import type { ServiceAdapter } from "@/lib/adapters/types";
import type { FieldTask, FieldOpsService } from "@/lib/types";

// Import adapters so they self-register
import "@/lib/adapters/twitter-adapter";
import "@/lib/adapters/ethereum-adapter";
import "@/lib/adapters/reddit-adapter";
import "@/lib/adapters/linkedin-adapter";
import "@/lib/adapters/stripe-adapter";

/** Strip sensitive fields from result data before logging */
function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set([
    "password", "masterPassword", "token", "accessToken", "refreshToken",
    "apiKey", "apiSecret", "secret", "privateKey", "accessTokenSecret",
    "clientSecret", "encryptedData", "authTag",
  ]);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Rough USD estimate for a transaction based on task payload.
 * This is a best-effort heuristic — adapters should provide accurate amounts. */
function estimateTransactionUsd(task: FieldTask, service: FieldOpsService): number {
  const amount = Number(task.payload.amount ?? 0);
  if (amount <= 0) return 0;

  const operation = (task.payload.operation as string) ?? "";

  // Crypto operations — use rough ETH/USDC prices
  if (operation === "send-eth") return amount * 2000; // ~$2000/ETH estimate
  if (operation === "send-usdc") return amount; // USDC is 1:1 USD

  // Payment operations (Stripe etc.) — amount likely in USD already
  if (["payment", "refund"].includes(operation)) return amount;

  // Default: if service is high-risk and has an amount, assume USD
  if (service.riskLevel === "high" && amount > 0) return amount;

  return 0; // Non-financial operation
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // ── 1. Validate request body ──
  const validation = await validateBody(request, executeTaskSchema);
  if (!validation.success) return validation.error;

  const { taskId, masterPassword, actor, dryRun } = validation.data;
  const execActor = actor ?? "system";

  // ── 2. Load task ──
  const tasksData = await getFieldTasks();
  const foundTask = tasksData.tasks.find((t) => t.id === taskId);
  if (!foundTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Bind to a non-nullable const for use throughout
  const task: FieldTask = foundTask;

  // ── 3. Validate task is approved ──
  if (task.status !== "approved") {
    return NextResponse.json(
      { error: `Task must be in "approved" status to execute (current: "${task.status}")` },
      { status: 400 },
    );
  }

  if (!isValidTransition("approved", "executing")) {
    return NextResponse.json(
      { error: "Invalid state transition: approved → executing" },
      { status: 400 },
    );
  }

  // ── 4. Resolve service ──
  const servicesData = await getFieldServices();
  const service: FieldOpsService | null = task.serviceId
    ? servicesData.services.find((s) => s.id === task.serviceId) ?? null
    : null;

  if (task.serviceId && !service) {
    return NextResponse.json(
      { error: `Service "${task.serviceId}" not found` },
      { status: 400 },
    );
  }

  // ── 4a. Check service is connected ──
  if (service && service.status !== "connected") {
    return NextResponse.json(
      {
        error: `${service.name} is not connected. Connect it in Field Ops → Services before ${dryRun ? "testing" : "executing"} tasks.`,
        serviceId: service.id,
        serviceStatus: service.status,
      },
      { status: 400 },
    );
  }

  // ── 4b. Rate limit execution per service ──
  if (service) {
    const rateCheck = executionRateLimiter.checkLimit(service.id);
    if (!rateCheck.allowed) {
      const retryAfterSeconds = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
      return NextResponse.json(
        { error: `Service "${service.name}" rate limited. Max 10 executions per 5 minutes. Retry after ${retryAfterSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

  // ── 4d. Spend limit enforcement ──
  if (service && !dryRun) {
    const safetyLimits = await getSafetyLimits();
    // Estimate USD amount from payload (adapters report this)
    const estimatedUsd = estimateTransactionUsd(task, service);
    if (estimatedUsd > 0) {
      const limitError = checkSpendLimits(safetyLimits, service.id, estimatedUsd, (task.payload.operation as string) ?? "unknown");
      if (limitError) {
        await addFieldActivityEvent({
          type: "field_task_failed",
          actor: execActor,
          taskId,
          serviceId: task.serviceId,
          missionId: task.missionId,
          summary: `Spend limit blocked: ${task.title}`,
          details: limitError,
          metadata: { estimatedUsd, serviceId: service.id },
        });

        // If pause-on-breach is enabled, pause all active missions
        if (safetyLimits.global.pauseOnBreach) {
          await mutateFieldMissions(async (data) => {
            for (const m of data.missions) {
              if (m.status === "active") {
                m.status = "paused";
                m.updatedAt = new Date().toISOString();
              }
            }
          });
        }

        return NextResponse.json(
          { error: `Spend limit exceeded: ${limitError}` },
          { status: 403 },
        );
      }
    }
  }

  // ── 5. Find adapter ──
  let resolvedAdapter: ServiceAdapter | undefined;

  // Look up adapter by service ID, then by catalogId
  if (service) {
    resolvedAdapter = getAdapter(service.id);
    if (!resolvedAdapter && service.catalogId) {
      resolvedAdapter = getAdapter(service.catalogId);
    }
  }

  if (!resolvedAdapter) {
    // No adapter available — fall back to manual execution
    await mutateFieldTasks(async (data) => {
      const t = data.tasks.find((t) => t.id === taskId);
      if (t) {
        t.status = "executing";
        t.executedAt = new Date().toISOString();
        t.updatedAt = new Date().toISOString();
      }
    });

    await addFieldActivityEvent({
      type: "field_task_executing",
      actor: execActor,
      taskId,
      serviceId: task.serviceId,
      missionId: task.missionId,
      summary: `Task "${task.title}" started (manual execution — no adapter)`,
      details: "No adapter registered for this service. Task moved to executing for manual completion.",
    });

    return NextResponse.json({
      taskId,
      status: "executing",
      mode: "manual",
      message: "No adapter available. Task moved to executing for manual completion.",
    });
  }

  // ── 5b. Check signing mode ──
  const signingMode = (service?.config?.signingMode as string) ?? "vault";
  if (signingMode === "wallet" && !dryRun) {
    // Wallet mode — don't execute server-side, redirect to prepare flow
    return NextResponse.json({
      error: "This service uses wallet signing mode. Use POST /api/field-ops/execute/prepare to prepare the transaction for browser signing.",
      signingMode: "wallet",
      prepareUrl: "/api/field-ops/execute/prepare",
    }, { status: 400 });
  }

  // ── 6. Validate payload ──
  const payloadValidation = resolvedAdapter.validatePayload(task.payload);
  if (!payloadValidation.valid) {
    return NextResponse.json(
      {
        error: "Payload validation failed",
        details: payloadValidation.errors,
      },
      { status: 400 },
    );
  }

  // ── 6b. Dry run — return after validation, skip real execution ──
  if (dryRun) {
    await addFieldActivityEvent({
      type: "field_task_executing",
      actor: execActor,
      taskId,
      serviceId: task.serviceId,
      missionId: task.missionId,
      summary: `Dry run: "${task.title}" validated via ${resolvedAdapter.name}`,
      details: "Dry run — payload validated, credentials and API call skipped.",
    });

    return NextResponse.json({
      taskId,
      status: "approved",
      dryRun: true,
      adapter: resolvedAdapter.name,
      payloadValid: true,
      message: "Dry run — validation passed, API call not made. Task remains approved.",
    });
  }

  // ── 6c. Staleness check — auto pre-validate if service hasn't run in 3 days ──
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  let stalenessCheck = false;

  if (service && !dryRun) {
    const isStale =
      !service.lastUsed ||
      Date.now() - new Date(service.lastUsed).getTime() > THREE_DAYS_MS;

    if (isStale) {
      // Payload already validated above — run it again to confirm (idempotent)
      const staleValidation = resolvedAdapter.validatePayload(task.payload);
      if (!staleValidation.valid) {
        return NextResponse.json(
          {
            error: `Service "${service.name}" hasn't been used in 3+ days. Pre-execution check failed: ${staleValidation.errors.join(", ")}`,
            staleness: true,
            details: staleValidation.errors,
          },
          { status: 400 },
        );
      }
      stalenessCheck = true;
      await addFieldActivityEvent({
        type: "field_task_executing",
        actor: execActor,
        taskId,
        serviceId: task.serviceId,
        missionId: task.missionId,
        summary: `Staleness pre-check passed for "${service.name}" before executing "${task.title}"`,
        details: `Service last used: ${service.lastUsed ?? "never"}. Payload validated successfully before execution.`,
      });
    }
  }

  // ── 7. Decrypt credentials ──
  let credentials: Record<string, unknown> = {};

  if (service?.credentialId) {
    // Resolve master password: session cache or request body
    const password = vaultSession.getPassword() ?? masterPassword ?? null;
    if (!password) {
      return NextResponse.json(
        { error: "Vault is locked. Provide masterPassword or unlock the vault session first." },
        { status: 401 },
      );
    }

    const credData = await getFieldCredentials();

    // Always verify password — even when vault session is active
    if (!credData.masterKeyHash) {
      return NextResponse.json(
        { error: "Vault not initialized" },
        { status: 400 },
      );
    }
    const valid = verifyMasterPassword(password, credData.masterKeyHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid master password" },
        { status: 403 },
      );
    }

    const credential = credData.credentials.find((c) => c.id === service.credentialId);
    if (!credential) {
      return NextResponse.json(
        { error: `Credential "${service.credentialId}" not found in vault` },
        { status: 400 },
      );
    }

    if (!credData.masterKeySalt) {
      return NextResponse.json(
        { error: "Vault encryption salt missing" },
        { status: 500 },
      );
    }

    try {
      const salt = Buffer.from(credData.masterKeySalt, "hex");
      const plaintext = decryptCredential(
        credential.encryptedData,
        credential.iv,
        credential.authTag,
        password,
        salt,
      );

      // Parse JSON credentials
      try {
        credentials = JSON.parse(plaintext);
      } catch {
        credentials = { raw: plaintext };
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to decrypt credentials. Check your master password." },
        { status: 403 },
      );
    }
  }

  // ── 8. Transition to executing ──
  await mutateFieldTasks(async (data) => {
    const t = data.tasks.find((t) => t.id === taskId);
    if (t) {
      t.status = "executing";
      t.executedAt = new Date().toISOString();
      t.updatedAt = new Date().toISOString();
    }
  });

  await addFieldActivityEvent({
    type: "field_task_executing",
    actor: execActor,
    taskId,
    serviceId: task.serviceId,
    missionId: task.missionId,
    summary: `Task "${task.title}" executing via ${resolvedAdapter.name}`,
    details: `Adapter: ${resolvedAdapter.name}, Operation: ${task.payload.operation ?? "default"}`,
  });

  // ── 9. Execute via adapter ──
  const result = await resolvedAdapter.execute({
    task,
    service: service!,
    credentials,
    dryRun,
  });

  // Record execution for rate limiting
  if (service) {
    executionRateLimiter.recordExecution(service.id);
  }

  // ── 9b. Zeroize credentials from memory ──
  for (const key of Object.keys(credentials)) {
    if (typeof credentials[key] === "string") {
      credentials[key] = "";
    }
  }
  credentials = {};

  // ── 10. Update task with result ──
  const now = new Date().toISOString();

  await mutateFieldTasks(async (data) => {
    const t = data.tasks.find((t) => t.id === taskId);
    if (t) {
      t.result = result.data;
      if (result.success) {
        t.status = "completed";
        t.completedAt = now;
      } else {
        t.status = "failed";
        t.result = {
          ...result.data,
          error: result.error,
          apiResponseCode: result.apiResponseCode,
        };
      }
      t.updatedAt = now;
    }
  });

  // ── 10b. Log spend to safety limits ──
  if (result.success && service) {
    const spentUsd = estimateTransactionUsd(task, service);
    if (spentUsd > 0) {
      await mutateSafetyLimits(async (data) => {
        data.spendLog.push({
          serviceId: service!.id,
          amountUsd: spentUsd,
          operation: (task.payload.operation as string) ?? "unknown",
          taskId,
          timestamp: new Date().toISOString(),
        });
        data.spendLog = pruneSpendLog(data.spendLog);
      });
    }
  }

  // ── 11. Update service lastUsed ──
  if (service) {
    await mutateFieldServices(async (data) => {
      const s = data.services.find((s) => s.id === service!.id);
      if (s) {
        s.lastUsed = now;
      }
    });
  }

  // ── 12. Log result event ──
  await addFieldActivityEvent({
    type: result.success ? "field_task_completed" : "field_task_failed",
    actor: execActor,
    taskId,
    serviceId: task.serviceId,
    missionId: task.missionId,
    summary: result.success
      ? `Task "${task.title}" completed successfully`
      : `Task "${task.title}" failed: ${result.error}`,
    details: JSON.stringify(sanitizeForLog(result.data)).slice(0, 1000),
    metadata: {
      executionMs: result.executionMs,
      apiResponseCode: result.apiResponseCode,
      adapterName: resolvedAdapter.name,
    },
  });

  // ── 13. Check circuit breaker for mission ──
  if (task.missionId && !result.success) {
    const freshTasks = await getFieldTasks();
    const missionTasks = freshTasks.tasks.filter((t) => t.missionId === task.missionId);
    const statuses = missionTasks.map((t) => t.status);

    if (shouldTripCircuitBreaker(statuses)) {
      await mutateFieldMissions(async (data) => {
        const mission = data.missions.find((m) => m.id === task.missionId);
        if (mission && mission.status === "active") {
          mission.status = "paused";
          mission.updatedAt = new Date().toISOString();
        }
      });

      await addFieldActivityEvent({
        type: "circuit_breaker_tripped",
        actor: "system",
        taskId,
        serviceId: task.serviceId,
        missionId: task.missionId,
        summary: "Circuit breaker tripped — mission paused after consecutive failures",
        details: `Mission "${task.missionId}" auto-paused. ${missionTasks.filter((t) => t.status === "failed").length} failed tasks detected.`,
      });
    }
  }

  // ── 14. Post to regular inbox + activity log (agent notification bridge) ──
  {
    // Re-read the task to get the final state with result data
    const freshData = await getFieldTasks();
    const finalTask = freshData.tasks.find((t) => t.id === taskId);
    if (finalTask) {
      if (result.success) {
        await notifyFieldTaskCompleted(finalTask);
        await logFieldOpsActivity(
          "field_task_completed",
          execActor,
          finalTask.linkedTaskId,
          `Field task completed: ${finalTask.title}`,
          `Field task "${finalTask.title}" (${finalTask.id}) executed successfully via ${resolvedAdapter.name}. Result: ${JSON.stringify(sanitizeForLog(result.data)).slice(0, 300)}`,
        );
      } else {
        await notifyFieldTaskFailed(finalTask);
        await logFieldOpsActivity(
          "field_task_failed",
          execActor,
          finalTask.linkedTaskId,
          `Field task failed: ${finalTask.title}`,
          `Field task "${finalTask.title}" (${finalTask.id}) failed: ${result.error ?? "unknown error"}`,
        );
      }
    }
  }

  // ── 15. Unblock dependent field tasks (task chaining) ──
  if (result.success) {
    await mutateFieldTasks(async (data) => {
      let unblockedCount = 0;
      for (const t of data.tasks) {
        if (t.blockedBy && t.blockedBy.includes(taskId)) {
          t.blockedBy = t.blockedBy.filter((id) => id !== taskId);
          t.updatedAt = new Date().toISOString();
          unblockedCount++;
        }
      }
      if (unblockedCount > 0) {
        await addFieldActivityEvent({
          type: "field_task_completed",
          actor: "system",
          taskId,
          serviceId: task.serviceId,
          missionId: task.missionId,
          summary: `${unblockedCount} dependent task(s) unblocked after "${task.title}" completed`,
          details: `Task "${task.title}" (${taskId}) completed, removing it from blockedBy arrays of ${unblockedCount} downstream task(s).`,
        });
      }
    });
  }

  // ── 15b. Unblock regular tasks that depend on this field task ──
  if (result.success) {
    const completedFieldTaskId = taskId;
    await mutateTasks(async (data) => {
      let unblockedRegular = 0;
      for (const t of data.tasks) {
        if (t.blockedBy && t.blockedBy.includes(completedFieldTaskId)) {
          t.blockedBy = t.blockedBy.filter((id) => id !== completedFieldTaskId);
          t.updatedAt = new Date().toISOString();
          unblockedRegular++;

          // Notify the assigned agent if all blockers are now cleared
          if (t.blockedBy.length === 0 && t.assignedTo) {
            await mutateInbox(async (inboxData) => {
              inboxData.messages.push({
                id: generateId("msg"),
                from: "system",
                to: t.assignedTo!,
                type: "update",
                taskId: t.id,
                subject: `Task unblocked: "${t.title}"`,
                body: `Your task "${t.title}" is now unblocked. The field task "${task.title}" (${completedFieldTaskId}) has completed successfully, clearing the last dependency.`,
                status: "unread",
                createdAt: new Date().toISOString(),
                readAt: null,
              });
            });
          }
        }
      }
      if (unblockedRegular > 0) {
        await addFieldActivityEvent({
          type: "field_task_completed",
          actor: "system",
          taskId: completedFieldTaskId,
          serviceId: task.serviceId,
          missionId: task.missionId,
          summary: `${unblockedRegular} regular task(s) unblocked after field task "${task.title}" completed`,
          details: `Field task "${task.title}" (${completedFieldTaskId}) completed, unblocking ${unblockedRegular} dependent regular task(s).`,
        });
      }
    });
  }

  // ── 16. Return result ──
  return NextResponse.json({
    taskId,
    status: result.success ? "completed" : "failed",
    result: result.data,
    error: result.error ?? null,
    executionMs: result.executionMs ?? null,
    apiResponseCode: result.apiResponseCode ?? null,
    stalenessCheck: stalenessCheck || undefined,
  });
}
