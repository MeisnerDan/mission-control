/**
 * run-task.ts — Standalone script to execute a single task via Claude Code.
 *
 * Usage:
 *   node --import tsx scripts/daemon/run-task.ts <taskId> [--source manual|project-run|mission-chain] [--agent-teams] [--mission <missionId>] [--continuation N] [--run-id ID]
 *
 * This script:
 *   1. Validates the task (exists, has agent, not done, not already running, not blocked)
 *   2. Writes a "running" entry to active-runs.json
 *   3. Builds the prompt via buildTaskPrompt()
 *   4. Spawns Claude Code via AgentRunner.spawnAgent()
 *   5. Updates active-runs.json with the final status (including cost/usage)
 *   6. If the agent timed out or hit max turns, spawns a continuation session
 *   7. If all continuations exhausted, logs task_failed and posts failure report
 *   8. If part of a mission, chains dispatch to the next batch of tasks
 *   9. Prunes completed runs older than 1 hour
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { AgentRunner, parseClaudeOutput } from "./runner";
import { buildTaskPrompt, getTask, isTaskUnblocked, hasPendingDecision } from "./prompt-builder";
import { loadConfig } from "./config";
import { logger } from "./logger";
import { handleTaskCompletion, handleTaskFailure, extractSummary, appendTaskProgress } from "./bookkeeping";
import type { MissionRun, MissionsFile } from "./types";

// ─── Paths ──────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../../data");
const ACTIVE_RUNS_FILE = path.join(DATA_DIR, "active-runs.json");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const INBOX_FILE = path.join(DATA_DIR, "inbox.json");
const MISSIONS_FILE = path.join(DATA_DIR, "missions.json");
const DECISIONS_FILE = path.join(DATA_DIR, "decisions.json");
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

// ─── Active Runs File I/O ───────────────────────────────────────────────────

interface ActiveRunEntry {
  id: string;
  taskId: string;
  agentId: string;
  projectId: string | null;
  missionId: string | null;
  pid: number;
  status: "running" | "completed" | "failed" | "timeout" | "stopped";
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
  error: string | null;
  costUsd: number | null;
  numTurns: number | null;
  continuationIndex: number;
}

interface ActiveRunsData {
  runs: ActiveRunEntry[];
}

function readActiveRuns(): ActiveRunsData {
  try {
    if (!existsSync(ACTIVE_RUNS_FILE)) return { runs: [] };
    const raw = readFileSync(ACTIVE_RUNS_FILE, "utf-8");
    return JSON.parse(raw) as ActiveRunsData;
  } catch {
    return { runs: [] };
  }
}

function writeActiveRuns(data: ActiveRunsData): void {
  writeFileSync(ACTIVE_RUNS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Prune completed/failed/timeout/stopped runs older than 1 hour.
 */
function pruneOldRuns(data: ActiveRunsData): ActiveRunsData {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();

  data.runs = data.runs.filter((run) => {
    if (run.status === "running") return true;
    if (!run.completedAt) return true;
    return now - new Date(run.completedAt).getTime() < ONE_HOUR;
  });

  return data;
}

// ─── Missions File I/O ──────────────────────────────────────────────────────

function readMissions(): MissionsFile {
  try {
    if (!existsSync(MISSIONS_FILE)) return { missions: [] };
    return JSON.parse(readFileSync(MISSIONS_FILE, "utf-8")) as MissionsFile;
  } catch {
    return { missions: [] };
  }
}

function writeMissions(data: MissionsFile): void {
  writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Post-completion side effects are in bookkeeping.ts (shared with dispatcher.ts)

/**
 * Spawn a continuation session for the same task.
 * Returns immediately — the continuation runs as a detached child process.
 */
function spawnContinuation(
  taskId: string,
  nextIndex: number,
  runId: string,
  source: string,
  agentTeams: boolean,
  missionId: string | null
): void {
  const scriptPath = path.resolve(__dirname, "run-task.ts");
  const args = [
    "--import", "tsx",
    scriptPath,
    taskId,
    "--source", source,
    "--continuation", String(nextIndex),
    "--run-id", runId,
  ];
  if (agentTeams) args.push("--agent-teams");
  if (missionId) args.push("--mission", missionId);

  try {
    const child = spawn(process.execPath, args, {
      cwd: WORKSPACE_ROOT,
      detached: true,
      stdio: "ignore",
      shell: false,
    });
    child.unref();
    logger.info("run-task", `Spawned continuation ${nextIndex} for task ${taskId} (pid: ${child.pid})`);
  } catch (err) {
    logger.error("run-task", `Failed to spawn continuation for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Mission Chain Dispatch ─────────────────────────────────────────────────

const MAX_LOOP_ATTEMPTS = 3; // After this many failures, create a decision point

/**
 * Post a mission completion/stalled report to inbox.json.
 */
function postMissionReport(mission: MissionRun): void {
  try {
    const inboxRaw = existsSync(INBOX_FILE)
      ? readFileSync(INBOX_FILE, "utf-8")
      : '{"messages":[]}';
    const inboxData = JSON.parse(inboxRaw) as { messages: Array<Record<string, unknown>> };

    const isComplete = mission.status === "completed";
    const subject = isComplete
      ? `Mission complete: ${mission.completedTasks}/${mission.totalTasks} tasks done`
      : `Mission stalled: ${mission.completedTasks}/${mission.totalTasks} tasks done, ${mission.totalTasks - mission.completedTasks - mission.failedTasks} remaining`;

    // Build summary body
    const lines: string[] = [];
    if (isComplete) {
      lines.push(`All ${mission.completedTasks} tasks in this mission have been completed successfully.`);
    } else {
      lines.push(`The mission has stalled with ${mission.totalTasks - mission.completedTasks - mission.failedTasks} task(s) remaining that cannot be dispatched.`);
    }

    if (mission.failedTasks > 0) {
      lines.push(`\n${mission.failedTasks} task(s) failed during execution.`);
    }

    // List completed tasks with file locations
    const completed = mission.taskHistory.filter(e => e.status === "completed");
    if (completed.length > 0) {
      lines.push("\n**Completed tasks:**");
      for (const entry of completed) {
        lines.push(`- ${entry.taskTitle} (${entry.agentId})`);
        // Extract file paths from summary
        const filePaths = entry.summary.match(/(?:research|projects|docs|output)\/[\w\-/.]+\.\w+/g);
        if (filePaths) {
          for (const fp of [...new Set(filePaths)].slice(0, 3)) {
            lines.push(`  → ${fp}`);
          }
        }
      }
    }

    // List failed tasks
    const failed = mission.taskHistory.filter(e => e.status !== "completed");
    if (failed.length > 0) {
      lines.push("\n**Failed tasks:**");
      for (const entry of failed) {
        lines.push(`- ${entry.taskTitle} (${entry.status}, attempt ${entry.attempt})`);
      }
    }

    if (!isComplete) {
      lines.push("\nPlease check the Status Board for any remaining tasks. Some may need your input on the Decisions page.");
    }

    inboxData.messages.push({
      id: `msg_${Date.now()}`,
      from: "system",
      to: "me",
      type: "report",
      taskId: null,
      subject,
      body: lines.join("\n"),
      status: "unread",
      createdAt: new Date().toISOString(),
      readAt: null,
    });

    writeFileSync(INBOX_FILE, JSON.stringify(inboxData, null, 2), "utf-8");
    logger.info("run-task", `Posted mission ${isComplete ? "completion" : "stalled"} report to inbox`);
  } catch (err) {
    logger.error("run-task", `Failed to post mission report: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Check if a task has a pending decision (local copy to avoid circular deps).
 */
function checkPendingDecision(taskId: string): boolean {
  try {
    const raw = readFileSync(DECISIONS_FILE, "utf-8");
    const data = JSON.parse(raw) as { decisions: Array<{ taskId: string | null; status: string }> };
    return data.decisions.some((d) => d.taskId === taskId && d.status === "pending");
  } catch {
    return false;
  }
}

/**
 * Check if a task is unblocked (all blockedBy tasks are done). Local version.
 */
function checkTaskUnblocked(blockedBy: string[]): boolean {
  if (!blockedBy || blockedBy.length === 0) return true;
  try {
    const raw = readFileSync(TASKS_FILE, "utf-8");
    const data = JSON.parse(raw) as { tasks: Array<{ id: string; kanban: string }> };
    return blockedBy.every((blockerId) => {
      const blocker = data.tasks.find((t) => t.id === blockerId);
      return blocker?.kanban === "done";
    });
  } catch {
    return false;
  }
}

/**
 * Create a decision point when a task has failed too many times (loop detection).
 */
function checkLoopAndEscalate(
  mission: MissionRun,
  taskId: string,
  taskTitle: string,
  agentId: string,
  errorMsg: string
): void {
  const attempts = mission.loopDetection.taskAttempts[taskId] ?? 0;

  // Track error messages for pattern detection
  if (!mission.loopDetection.taskErrors[taskId]) {
    mission.loopDetection.taskErrors[taskId] = [];
  }
  mission.loopDetection.taskErrors[taskId].push(errorMsg.slice(0, 200));
  // Keep last 5 errors
  if (mission.loopDetection.taskErrors[taskId].length > 5) {
    mission.loopDetection.taskErrors[taskId] = mission.loopDetection.taskErrors[taskId].slice(-5);
  }

  // After MAX_LOOP_ATTEMPTS failures, create a decision point
  if (attempts >= MAX_LOOP_ATTEMPTS) {
    try {
      const decisionsRaw = existsSync(DECISIONS_FILE)
        ? readFileSync(DECISIONS_FILE, "utf-8")
        : '{"decisions":[]}';
      const decisions = JSON.parse(decisionsRaw) as { decisions: Array<Record<string, unknown>> };

      // Don't create duplicate decisions
      const existing = decisions.decisions.find(
        (d) => d.taskId === taskId && d.status === "pending"
      );
      if (existing) return;

      const recentErrors = mission.loopDetection.taskErrors[taskId] ?? [];
      const lastError = recentErrors.length > 0 ? recentErrors[recentErrors.length - 1] : "Unknown error";

      decisions.decisions.push({
        id: `dec_${Date.now()}`,
        requestedBy: agentId,
        taskId,
        question: `Task "${taskTitle}" has failed ${attempts} time${attempts !== 1 ? "s" : ""}. How should I proceed?`,
        options: [
          "Retry with a different approach",
          "Skip this task and continue mission",
          "Stop the entire mission",
        ],
        context: `Last error: ${lastError}\n\nAttempt history: ${attempts} attempts. The agent "${agentId}" has been unable to complete this task.`,
        status: "pending",
        answer: null,
        answeredAt: null,
        createdAt: new Date().toISOString(),
      });

      writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2), "utf-8");
      logger.warn("run-task", `Loop detected for task ${taskId} (${attempts} attempts). Decision created.`);
    } catch (err) {
      logger.error("run-task", `Failed to create loop decision for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * After a task finishes (success, fail, or timeout), check if the mission
 * should continue and dispatch the next batch of tasks.
 */
function handleMissionContinuation(
  missionId: string,
  completedTaskId: string,
  taskResult: {
    status: "completed" | "failed" | "timeout";
    summary: string;
    agentId: string;
    taskTitle: string;
    errorMsg: string;
  }
): void {
  const missionsData = readMissions();
  const mission = missionsData.missions.find((m) => m.id === missionId);
  if (!mission) return;
  if (mission.status === "completed" || mission.status === "stopped") return;
  // Revive stalled missions — this task just completed, so there may be new work
  if (mission.status === "stalled") {
    logger.info("run-task", `Mission ${missionId}: reviving from stalled → running`);
    mission.status = "running";
  }

  // 1. Update mission stats + timestamp for reconciliation grace period
  mission.lastTaskCompletedAt = new Date().toISOString();
  if (taskResult.status === "completed") {
    mission.completedTasks++;
  } else {
    mission.failedTasks++;
  }

  // 2. Update loop detection counters
  const prevAttempts = mission.loopDetection.taskAttempts[completedTaskId] ?? 0;
  mission.loopDetection.taskAttempts[completedTaskId] = prevAttempts + 1;

  // 3. Add to task history (for restart context)
  mission.taskHistory.push({
    taskId: completedTaskId,
    taskTitle: taskResult.taskTitle,
    agentId: taskResult.agentId,
    status: taskResult.status,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: taskResult.summary.slice(0, 500),
    attempt: prevAttempts + 1,
  });

  // 4. If task failed, check for loop/insanity and maybe create decision
  if (taskResult.status !== "completed") {
    checkLoopAndEscalate(
      mission,
      completedTaskId,
      taskResult.taskTitle,
      taskResult.agentId,
      taskResult.errorMsg
    );
  }

  // 5. Check if ALL project tasks are done
  let tasksData: { tasks: Array<Record<string, unknown>> };
  try {
    tasksData = JSON.parse(readFileSync(TASKS_FILE, "utf-8"));
  } catch {
    logger.error("run-task", `Mission ${missionId}: could not read tasks.json for continuation`);
    writeMissions(missionsData);
    return;
  }

  const projectTasks = tasksData.tasks.filter(
    (t) => t.projectId === mission.projectId
  );
  const remaining = projectTasks.filter(
    (t) =>
      t.kanban !== "done" &&
      t.assignedTo &&
      t.assignedTo !== "me" &&
      !t.deletedAt
  );

  if (remaining.length === 0) {
    // Mission complete!
    mission.status = "completed";
    mission.completedAt = new Date().toISOString();
    writeMissions(missionsData);
    logger.info("run-task", `Mission ${missionId} COMPLETED. All tasks done.`);
    postMissionReport(mission);
    return;
  }

  // 6. Find dispatchable tasks
  const activeRuns = readActiveRuns();
  const runningTaskIds = new Set(
    activeRuns.runs.filter((r) => r.status === "running").map((r) => r.taskId)
  );

  const dispatchable = remaining.filter((t) => {
    const tid = t.id as string;
    if (runningTaskIds.has(tid)) return false;
    // Check blocked
    const blocked = (t.blockedBy as string[] | undefined) ?? [];
    if (blocked.length > 0 && !checkTaskUnblocked(blocked)) return false;
    // Check decisions
    if (checkPendingDecision(tid)) return false;
    // Check loop limit
    const attempts = mission.loopDetection.taskAttempts[tid] ?? 0;
    if (attempts >= MAX_LOOP_ATTEMPTS) return false;
    return true;
  });

  // 7. Calculate available slots
  const config = loadConfig();
  const currentlyRunning = activeRuns.runs.filter((r) => r.status === "running").length;
  const slotsAvailable = Math.max(0, config.concurrency.maxParallelAgents - currentlyRunning);
  const toSpawn = dispatchable.slice(0, slotsAvailable);

  // 8. Save updated mission BEFORE spawning (prevents race conditions)
  writeMissions(missionsData);

  // 9. Spawn next batch
  if (toSpawn.length > 0) {
    const scriptPath = path.resolve(__dirname, "run-task.ts");
    for (const task of toSpawn) {
      const args = [
        "--import", "tsx",
        scriptPath,
        task.id as string,
        "--source", "mission-chain",
        "--mission", missionId,
      ];
      if (config.execution.agentTeams) {
        args.push("--agent-teams");
      }
      try {
        const child = spawn(process.execPath, args, {
          cwd: WORKSPACE_ROOT,
          detached: true,
          stdio: "ignore",
          shell: false,
        });
        child.unref();
        logger.info("run-task", `Mission ${missionId}: chained task ${task.id} (pid: ${child.pid})`);
      } catch (err) {
        logger.error("run-task", `Mission ${missionId}: failed to chain task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // 10. Check if mission is stalled (nothing running, nothing dispatchable, but tasks remain)
  if (toSpawn.length === 0 && currentlyRunning === 0) {
    // No processes running and nothing to dispatch — check if deps could still resolve
    const remainingIds = new Set(remaining.map((t) => t.id as string));
    const hasResolvableDeps = remaining.some((t) => {
      const blocked = (t.blockedBy as string[] | undefined) ?? [];
      if (blocked.length === 0) return false;
      // Check if unmet deps are other project tasks that could still complete
      return blocked.some((depId) => remainingIds.has(depId));
    });

    if (hasResolvableDeps) {
      // Dependencies could resolve from other project tasks — don't stall yet,
      // let the reconciler re-dispatch when dependencies complete
      logger.info("run-task", `Mission ${missionId}: waiting — ${remaining.length} tasks remain with resolvable dependencies`);
      writeMissions(missionsData);
    } else {
      const hasBlockedTasks = remaining.some((t) => {
        const blocked = (t.blockedBy as string[] | undefined) ?? [];
        return blocked.length > 0 && !checkTaskUnblocked(blocked);
      });
      const hasDecisionTasks = remaining.some((t) => checkPendingDecision(t.id as string));
      const hasLoopLimitTasks = remaining.some((t) => {
        const attempts = mission.loopDetection.taskAttempts[t.id as string] ?? 0;
        return attempts >= MAX_LOOP_ATTEMPTS;
      });

      mission.status = "stalled";
      mission.skippedTasks = remaining.length - dispatchable.length;
      writeMissions(missionsData);
      logger.warn("run-task", `Mission ${missionId}: STALLED — ${remaining.length} tasks remain but none dispatchable (blocked: ${hasBlockedTasks}, decisions: ${hasDecisionTasks}, loop-limit: ${hasLoopLimitTasks})`);
      postMissionReport(mission);
    }
  }
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): {
  taskId: string;
  source: string;
  agentTeams: boolean;
  missionId: string | null;
  continuationIndex: number;
  runId: string | null;
} {
  const args = process.argv.slice(2);
  const taskId = args[0];

  if (!taskId) {
    console.error("Usage: run-task.ts <taskId> [--source manual|project-run|mission-chain] [--agent-teams] [--mission <missionId>] [--continuation N] [--run-id ID]");
    process.exit(1);
  }

  let source = "manual";
  let agentTeams = false;
  let missionId: string | null = null;
  let continuationIndex = 0;
  let runId: string | null = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[i + 1];
      i++;
    }
    if (args[i] === "--agent-teams") {
      agentTeams = true;
    }
    if (args[i] === "--mission" && args[i + 1]) {
      missionId = args[i + 1];
      i++;
    }
    if (args[i] === "--continuation" && args[i + 1]) {
      continuationIndex = parseInt(args[i + 1], 10) || 0;
      i++;
    }
    if (args[i] === "--run-id" && args[i + 1]) {
      runId = args[i + 1];
      i++;
    }
  }

  return { taskId, source, agentTeams, missionId, continuationIndex, runId };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { taskId, source, agentTeams, missionId, continuationIndex, runId: existingRunId } = parseArgs();
  const isContinuation = continuationIndex > 0;

  logger.info("run-task", `Starting task ${taskId} (source: ${source}, agentTeams: ${agentTeams}, mission: ${missionId ?? "none"}, continuation: ${continuationIndex}${existingRunId ? `, runId: ${existingRunId}` : ""})`);

  // 1. Validate task exists
  const task = getTask(taskId);
  if (!task) {
    logger.error("run-task", `Task not found: ${taskId}`);
    process.exit(1);
  }

  // 2. Validate task has an assigned agent
  if (!task.assignedTo || task.assignedTo === "me") {
    logger.error("run-task", `Task ${taskId} has no AI agent assigned (assignedTo: ${task.assignedTo})`);
    process.exit(1);
  }

  // 3. Validate task is not already done
  if (task.kanban === "done") {
    logger.error("run-task", `Task ${taskId} is already done`);
    process.exit(1);
  }

  // 4. Check not already running (skip for continuations — previous session just ended)
  if (!isContinuation) {
    const currentRuns = readActiveRuns();
    const alreadyRunning = currentRuns.runs.find(
      (r) => r.taskId === taskId && r.status === "running"
    );
    if (alreadyRunning) {
      logger.error("run-task", `Task ${taskId} is already running (pid: ${alreadyRunning.pid})`);
      process.exit(1);
    }
  }

  // 5. Check if task is blocked (skip for continuations)
  if (!isContinuation) {
    const taskWithBlocked = task as typeof task & { blockedBy: string[] };
    if (taskWithBlocked.blockedBy && !isTaskUnblocked(taskWithBlocked)) {
      logger.error("run-task", `Task ${taskId} is blocked by unfinished dependencies`);
      process.exit(1);
    }
  }

  // 6. Check for pending decisions (skip for continuations)
  if (!isContinuation) {
    if (hasPendingDecision(taskId)) {
      logger.error("run-task", `Task ${taskId} has a pending decision — cannot execute`);
      process.exit(1);
    }
  }

  // 7. Load execution config
  const config = loadConfig();
  const { maxTurns, timeoutMinutes, skipPermissions, allowedTools } = config.execution;
  const maxTaskContinuations = config.execution.maxTaskContinuations ?? 2;
  const useAgentTeams = agentTeams || config.execution.agentTeams;

  // 8. Write "running" entry
  const runId = existingRunId ?? `run_${Date.now()}`;
  const currentRuns = readActiveRuns();

  if (!isContinuation) {
    const runEntry: ActiveRunEntry = {
      id: runId,
      taskId,
      agentId: task.assignedTo,
      projectId: task.projectId ?? null,
      missionId,
      pid: 0, // Will be updated after spawn via onSpawned
      status: "running",
      startedAt: new Date().toISOString(),
      completedAt: null,
      exitCode: null,
      error: null,
      costUsd: null,
      numTurns: null,
      continuationIndex,
    };
    currentRuns.runs.push(runEntry);
  } else {
    // For continuations, create a new run entry linked by the same runId prefix
    const contRunId = `${runId}_c${continuationIndex}`;
    const runEntry: ActiveRunEntry = {
      id: contRunId,
      taskId,
      agentId: task.assignedTo,
      projectId: task.projectId ?? null,
      missionId,
      pid: 0,
      status: "running",
      startedAt: new Date().toISOString(),
      completedAt: null,
      exitCode: null,
      error: null,
      costUsd: null,
      numTurns: null,
      continuationIndex,
    };
    currentRuns.runs.push(runEntry);
  }
  writeActiveRuns(pruneOldRuns(currentRuns));

  const activeRunId = isContinuation ? `${runId}_c${continuationIndex}` : runId;
  logger.info("run-task", `Run ${activeRunId} created for task ${taskId} (agent: ${task.assignedTo}, session ${continuationIndex + 1})`);

  // 8.5. Mark task as "in-progress" (daemon handles this instead of the agent)
  if (!isContinuation) {
    const { markTaskInProgress } = await import("./bookkeeping");
    markTaskInProgress(taskId);
  }

  // 9. Build prompt (pass missionId for restart context)
  let prompt = buildTaskPrompt(task.assignedTo, task, missionId ?? undefined);

  // 9.5. Add continuation header if resuming from a previous session
  if (isContinuation) {
    const contHeader = `## ⚡ CONTINUATION SESSION

This is session ${continuationIndex + 1}. Previous session(s) ran out of turns or time before finishing.

**Important:**
- Check the task's notes field above — your prior progress summaries are there.
- Check the task's subtasks — some may already be marked done.
- Continue where you left off. Do NOT redo completed work.
- Focus on the remaining uncompleted items.

---

`;
    prompt = contHeader + prompt;
  }

  // 10. Spawn Claude Code
  const runner = new AgentRunner(WORKSPACE_ROOT);
  try {
    const result = await runner.spawnAgent({
      prompt,
      maxTurns,
      timeoutMinutes,
      skipPermissions,
      allowedTools,
      agentTeams: useAgentTeams,
      cwd: WORKSPACE_ROOT,
      onSpawned: (pid) => {
        // Update the PID in active-runs immediately after spawn
        try {
          const runs = readActiveRuns();
          const run = runs.runs.find((r) => r.id === activeRunId);
          if (run) {
            run.pid = pid;
            writeActiveRuns(runs);
          }
        } catch { /* non-fatal */ }
      },
    });

    // Parse cost/usage metadata from Claude Code JSON output
    const meta = parseClaudeOutput(result.stdout);

    // Update run entry with final status + cost
    const runs = readActiveRuns();
    const run = runs.runs.find((r) => r.id === activeRunId);
    let finalStatus: "completed" | "failed" | "timeout" = "failed";
    let errorMsg = "";

    // Detect if we should continue (timeout or max_turns exceeded)
    const hitMaxTurns = meta.subtype === "error_max_turns";
    const hitTimeout = result.timedOut || meta.subtype === "error_timeout";
    const shouldContinue = (hitMaxTurns || hitTimeout) && continuationIndex < maxTaskContinuations;

    if (run) {
      run.pid = result.pid;
      run.costUsd = meta.totalCostUsd;
      run.numTurns = meta.numTurns;

      if (shouldContinue) {
        // Session exhausted but we have continuations remaining — mark as completed (this session)
        run.status = "completed";
        run.error = hitTimeout
          ? `Session ${continuationIndex + 1} timed out — continuing`
          : `Session ${continuationIndex + 1} hit max turns — continuing`;
        finalStatus = "completed"; // This session is done, continuation takes over
      } else if (result.timedOut) {
        run.status = "timeout";
        run.error = `Timed out after ${timeoutMinutes} minutes (all ${continuationIndex + 1} session(s) exhausted)`;
        finalStatus = "timeout";
        errorMsg = run.error;
      } else if (result.exitCode === 0) {
        run.status = "completed";
        finalStatus = "completed";
      } else {
        run.status = "failed";
        finalStatus = "failed";
        // Try stderr first, then check stdout for JSON-formatted errors
        let errText = result.stderr?.trim()?.slice(0, 500);
        if (!errText && result.stdout?.trim()) {
          try {
            const parsed = JSON.parse(result.stdout);
            if (parsed.error) errText = String(parsed.error).slice(0, 500);
            else if (parsed.is_error) errText = String(parsed.result || "Unknown error").slice(0, 500);
          } catch {
            // Not JSON — use raw stdout excerpt
            errText = result.stdout.trim().slice(0, 200);
          }
        }
        run.error = errText || `Exit code: ${result.exitCode}`;
        errorMsg = run.error;
      }

      run.completedAt = new Date().toISOString();
      run.exitCode = result.exitCode;
      writeActiveRuns(pruneOldRuns(runs));
    }

    const costStr = meta.totalCostUsd != null ? ` · $${meta.totalCostUsd.toFixed(4)}` : "";
    logger.info(
      "run-task",
      `Run ${activeRunId} finished: status=${run?.status ?? "unknown"}, exitCode=${result.exitCode}, timedOut=${result.timedOut}${costStr}`
    );

    // ── Continuation path: spawn next session instead of completing/failing ──
    if (shouldContinue) {
      const summary = extractSummary(result.stdout);
      appendTaskProgress(taskId, continuationIndex, summary);

      logger.info("run-task", `Spawning continuation ${continuationIndex + 1} for task ${taskId}`);
      spawnContinuation(taskId, continuationIndex + 1, runId, source, agentTeams, missionId);
      // Exit — the continuation process takes over
      return;
    }

    // ── Normal completion path ──
    if (finalStatus === "completed" && result.exitCode === 0) {
      handleTaskCompletion(taskId, task.assignedTo, result.stdout);
    }

    // ── Failure path: all continuations exhausted ──
    if (finalStatus === "failed" || finalStatus === "timeout") {
      handleTaskFailure(taskId, task.assignedTo, errorMsg, continuationIndex);
    }

    // Chain dispatch: if this task is part of a mission, continue to next batch
    if (missionId) {
      try {
        handleMissionContinuation(missionId, taskId, {
          status: finalStatus,
          summary: extractSummary(result.stdout),
          agentId: task.assignedTo,
          taskTitle: task.title ?? taskId,
          errorMsg,
        });
      } catch (err) {
        logger.error("run-task", `Mission continuation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    // Update run as failed
    const runs = readActiveRuns();
    const run = runs.runs.find((r) => r.id === activeRunId);
    if (run) {
      run.status = "failed";
      run.error = err instanceof Error ? err.message : String(err);
      run.completedAt = new Date().toISOString();
      writeActiveRuns(pruneOldRuns(runs));
    }

    logger.error("run-task", `Run ${activeRunId} failed: ${err instanceof Error ? err.message : String(err)}`);

    // Log task_failed event
    handleTaskFailure(taskId, task.assignedTo, err instanceof Error ? err.message : String(err), continuationIndex);

    // Still try mission continuation on failure
    if (missionId) {
      try {
        handleMissionContinuation(missionId, taskId, {
          status: "failed",
          summary: "(execution error)",
          agentId: task.assignedTo,
          taskTitle: task.title ?? taskId,
          errorMsg: err instanceof Error ? err.message : String(err),
        });
      } catch (contErr) {
        logger.error("run-task", `Mission continuation failed after error: ${contErr instanceof Error ? contErr.message : String(contErr)}`);
      }
    }

    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("run-task", `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
