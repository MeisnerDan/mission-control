/**
 * bookkeeping.ts — Post-completion side effects shared by both dispatcher.ts
 * (daemon polling path) and run-task.ts (standalone/mission-chain path).
 *
 * Functions:
 *   - handleTaskCompletion: mark done, post inbox, log activity, regen context
 *   - handleTaskFailure: log failure event, post failure report
 *   - extractSummary: pull human-readable summary from Claude Code stdout
 *   - appendTaskProgress: append session progress notes to task
 *   - markTaskInProgress: set kanban to "in-progress"
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { logger } from "./logger";

const DATA_DIR = path.resolve(__dirname, "../../data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const INBOX_FILE = path.join(DATA_DIR, "inbox.json");
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, "activity-log.json");

// ─── Summary Extraction ─────────────────────────────────────────────────────

/**
 * Extract a human-readable summary from Claude Code's stdout.
 * Tries JSON parse first (Claude Code --output-format json has a `result` field),
 * falls back to the last 10 lines of raw text, truncated to 500 chars.
 */
export function extractSummary(stdout: string): string {
  // Try JSON output format first
  try {
    const parsed = JSON.parse(stdout);
    if (typeof parsed.result === "string" && parsed.result.length > 0) {
      return parsed.result.slice(0, 500);
    }
  } catch {
    // Not JSON — fall through to raw text
  }

  // Fall back to last 10 lines of raw text
  const lines = stdout.trim().split("\n");
  const tail = lines.slice(-10).join("\n");
  if (tail.length > 500) return tail.slice(0, 497) + "...";
  return tail || "(no output)";
}

// ─── Post-Completion Side Effects ────────────────────────────────────────────

/**
 * Post-completion side effects: mark task done, post inbox message, log activity.
 * Each step is wrapped in its own try/catch — if one fails, others still execute.
 */
export function handleTaskCompletion(taskId: string, agentId: string, stdout: string): void {
  const now = new Date().toISOString();
  const summary = extractSummary(stdout);

  // 1. Mark task as "done" (idempotent — only if not already done)
  try {
    const tasksRaw = readFileSync(TASKS_FILE, "utf-8");
    const tasksData = JSON.parse(tasksRaw) as { tasks: Array<Record<string, unknown>> };
    const task = tasksData.tasks.find((t) => t.id === taskId);
    if (task && task.kanban !== "done") {
      task.kanban = "done";
      task.completedAt = now;
      task.updatedAt = now;
      writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2), "utf-8");
      logger.info("bookkeeping", `Marked task ${taskId} as done`);
    }
  } catch (err) {
    logger.error("bookkeeping", `Failed to mark task ${taskId} as done: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Post inbox message (report from agent to "me")
  try {
    const inboxRaw = existsSync(INBOX_FILE)
      ? readFileSync(INBOX_FILE, "utf-8")
      : '{"messages":[]}';
    const inboxData = JSON.parse(inboxRaw) as { messages: Array<Record<string, unknown>> };

    // Fetch task title for the subject line
    let taskTitle = taskId;
    try {
      const tasksRaw = readFileSync(TASKS_FILE, "utf-8");
      const tasksData = JSON.parse(tasksRaw) as { tasks: Array<Record<string, unknown>> };
      const task = tasksData.tasks.find((t) => t.id === taskId);
      if (task && typeof task.title === "string") {
        taskTitle = task.title;
      }
    } catch {
      // Use taskId as fallback
    }

    inboxData.messages.push({
      id: `msg_${Date.now()}`,
      from: agentId,
      to: "me",
      type: "report",
      taskId,
      subject: `Completed: ${taskTitle}`,
      body: summary,
      status: "unread",
      createdAt: now,
      readAt: null,
    });

    writeFileSync(INBOX_FILE, JSON.stringify(inboxData, null, 2), "utf-8");
    logger.info("bookkeeping", `Posted completion report for task ${taskId}`);
  } catch (err) {
    logger.error("bookkeeping", `Failed to post inbox message for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Log activity event
  try {
    const logRaw = existsSync(ACTIVITY_LOG_FILE)
      ? readFileSync(ACTIVITY_LOG_FILE, "utf-8")
      : '{"events":[]}';
    const logData = JSON.parse(logRaw) as { events: Array<Record<string, unknown>> };

    logData.events.push({
      id: `evt_${Date.now()}`,
      type: "task_completed",
      actor: agentId,
      taskId,
      summary: `Completed task: ${taskId}`,
      details: summary,
      timestamp: now,
    });

    writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(logData, null, 2), "utf-8");
    logger.info("bookkeeping", `Logged task_completed event for task ${taskId}`);
  } catch (err) {
    logger.error("bookkeeping", `Failed to log activity for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Regenerate ai-context.md
  try {
    const missionControlDir = path.resolve(__dirname, "../..");
    execSync("npx tsx scripts/generate-context.ts", {
      cwd: missionControlDir,
      timeout: 30_000,
      stdio: "ignore",
    });
    logger.info("bookkeeping", `Regenerated ai-context.md after task ${taskId}`);
  } catch (err) {
    logger.error("bookkeeping", `Failed to regenerate ai-context.md: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Log a task_failed event to activity-log.json and post failure report to inbox.
 * Called when all continuation attempts are exhausted and the task still failed.
 */
export function handleTaskFailure(taskId: string, agentId: string, errorMsg: string, continuationIndex: number): void {
  const now = new Date().toISOString();

  // 1. Log activity event
  try {
    const logRaw = existsSync(ACTIVITY_LOG_FILE)
      ? readFileSync(ACTIVITY_LOG_FILE, "utf-8")
      : '{"events":[]}';
    const logData = JSON.parse(logRaw) as { events: Array<Record<string, unknown>> };

    // Get task title
    let taskTitle = taskId;
    try {
      const tasksRaw = readFileSync(TASKS_FILE, "utf-8");
      const tasksData = JSON.parse(tasksRaw) as { tasks: Array<Record<string, unknown>> };
      const task = tasksData.tasks.find((t) => t.id === taskId);
      if (task && typeof task.title === "string") taskTitle = task.title;
    } catch { /* use taskId */ }

    logData.events.push({
      id: `evt_${Date.now()}`,
      type: "task_failed",
      actor: agentId,
      taskId,
      summary: `Task failed: ${taskTitle}`,
      details: `Agent "${agentId}" failed after ${continuationIndex + 1} session(s). Error: ${errorMsg.slice(0, 300)}`,
      timestamp: now,
    });

    writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(logData, null, 2), "utf-8");
    logger.info("bookkeeping", `Logged task_failed event for task ${taskId}`);
  } catch (err) {
    logger.error("bookkeeping", `Failed to log task_failed activity for ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Post failure report to inbox
  try {
    const inboxRaw = existsSync(INBOX_FILE)
      ? readFileSync(INBOX_FILE, "utf-8")
      : '{"messages":[]}';
    const inboxData = JSON.parse(inboxRaw) as { messages: Array<Record<string, unknown>> };

    let taskTitle = taskId;
    try {
      const tasksRaw = readFileSync(TASKS_FILE, "utf-8");
      const tasksData = JSON.parse(tasksRaw) as { tasks: Array<Record<string, unknown>> };
      const task = tasksData.tasks.find((t) => t.id === taskId);
      if (task && typeof task.title === "string") taskTitle = task.title;
    } catch { /* use taskId */ }

    inboxData.messages.push({
      id: `msg_${Date.now()}`,
      from: agentId,
      to: "me",
      type: "report",
      taskId,
      subject: `Failed: ${taskTitle}`,
      body: `Task execution failed after ${continuationIndex + 1} session(s).\n\nError: ${errorMsg.slice(0, 500)}`,
      status: "unread",
      createdAt: now,
      readAt: null,
    });

    writeFileSync(INBOX_FILE, JSON.stringify(inboxData, null, 2), "utf-8");
    logger.info("bookkeeping", `Posted failure report for task ${taskId}`);
  } catch (err) {
    logger.error("bookkeeping", `Failed to post failure inbox message for ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Append progress notes to a task and update subtask completion status.
 * Used between continuation sessions so the next session knows what was done.
 */
export function appendTaskProgress(taskId: string, sessionIndex: number, summary: string): void {
  try {
    const tasksRaw = readFileSync(TASKS_FILE, "utf-8");
    const tasksData = JSON.parse(tasksRaw) as { tasks: Array<Record<string, unknown>> };
    const task = tasksData.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const progressNote = `[${timestamp}] Session ${sessionIndex + 1}: ${summary.slice(0, 300)}`;

    // Append to notes
    const existingNotes = typeof task.notes === "string" ? task.notes : "";
    task.notes = existingNotes
      ? `${existingNotes}\n\n${progressNote}`
      : progressNote;
    task.updatedAt = new Date().toISOString();

    writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2), "utf-8");
    logger.info("bookkeeping", `Appended progress note to task ${taskId} (session ${sessionIndex + 1})`);
  } catch (err) {
    logger.error("bookkeeping", `Failed to append progress to task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Mark a task as "in-progress" in tasks.json.
 * Idempotent — only updates if not already in-progress or done.
 */
export function markTaskInProgress(taskId: string): void {
  try {
    const tasksRaw = readFileSync(TASKS_FILE, "utf-8");
    const tasksData = JSON.parse(tasksRaw) as { tasks: Array<Record<string, unknown>> };
    const task = tasksData.tasks.find((t) => t.id === taskId);
    if (task && task.kanban !== "in-progress" && task.kanban !== "done") {
      task.kanban = "in-progress";
      task.updatedAt = new Date().toISOString();
      writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2), "utf-8");
      logger.info("bookkeeping", `Marked task ${taskId} as in-progress`);
    }
  } catch (err) {
    logger.error("bookkeeping", `Failed to mark task ${taskId} as in-progress: ${err instanceof Error ? err.message : String(err)}`);
  }
}
