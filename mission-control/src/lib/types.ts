export type Importance = "important" | "not-important";
export type Urgency = "urgent" | "not-urgent";
export type KanbanStatus = "not-started" | "in-progress" | "done";
export type GoalType = "long-term" | "medium-term";
export type GoalStatus = "not-started" | "in-progress" | "completed";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
// AgentRole is now a string validated against the agent registry at runtime.
// Built-in roles are kept as a type for backward compatibility.
export type BuiltInAgentRole = "me" | "researcher" | "developer" | "marketer" | "business-analyst";
export type AgentRole = string;

// Legacy constant kept for backward compat — UI should prefer dynamic agents from API.
export const AGENT_ROLES: { id: BuiltInAgentRole; label: string; icon: string; description: string }[] = [
  { id: "me", label: "Me", icon: "User", description: "Tasks I do myself" },
  { id: "researcher", label: "Researcher", icon: "Search", description: "Market research, analysis, evaluation" },
  { id: "developer", label: "Developer", icon: "Code", description: "Implementation, bug fixes, testing" },
  { id: "marketer", label: "Marketer", icon: "Megaphone", description: "Copy, growth strategy, content" },
  { id: "business-analyst", label: "Business Analyst", icon: "BarChart3", description: "Strategy, planning, prioritization" },
];

// ─── Agent Definition (dynamic registry) ──────────────────────────────────────

export type AgentStatus = "active" | "inactive";

export interface AgentDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  instructions: string;
  capabilities: string[];
  skillIds: string[];
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentsFile {
  agents: AgentDefinition[];
}

// ─── Skill Definition (skills library) ────────────────────────────────────────

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  agentIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillsLibraryFile {
  skills: SkillDefinition[];
}

// ─── AI Skills (slash commands) ───────────────────────────────────────────────

export interface SkillInfo {
  command: string;
  label: string;
  description: string;
  longDescription: string;
}

export const SKILLS: SkillInfo[] = [
  {
    command: "/standup",
    label: "Daily Standup",
    description: "Daily standup summary",
    longDescription: "Generates a standup report from git commits, in-progress tasks, inbox messages, and goal progress.",
  },
  {
    command: "/daily-plan",
    label: "Daily Plan",
    description: "Create daily plan",
    longDescription: "Creates a focused daily plan with top priorities, brain dump triage, pending decisions, and time blocks.",
  },
  {
    command: "/weekly-review",
    label: "Weekly Review",
    description: "Weekly review",
    longDescription: "Analyzes the week: tasks completed, goal progress, Eisenhower health, stale items, and next-week recommendations.",
  },
  {
    command: "/brainstorm",
    label: "Brainstorm",
    description: "Brainstorm ideas",
    longDescription: "Generates 10-15 creative ideas from multiple angles: technical, marketing, UX, business model, and partnerships.",
  },
  {
    command: "/research",
    label: "Research",
    description: "Research a topic",
    longDescription: "Researches a topic with web search, then saves structured findings to research/ with key insights and recommendations.",
  },
  {
    command: "/plan-feature",
    label: "Plan Feature",
    description: "Plan a feature",
    longDescription: "Breaks a feature into tasks with subtasks, estimates, dependencies, and creates a milestone with linked tasks.",
  },
  {
    command: "/ship-feature",
    label: "Ship Feature",
    description: "Ship a feature",
    longDescription: "Tests, lints, commits, updates task status, posts completion report to inbox, and logs activity.",
  },
  {
    command: "/pick-up-work",
    label: "Pick Up Work",
    description: "Check for new assignments",
    longDescription: "Checks inbox for new delegations, reviews pending tasks, and picks up the highest-priority unblocked work.",
  },
  {
    command: "/report",
    label: "Report",
    description: "Post a status report",
    longDescription: "Posts a status update or completion report to the inbox and logs the activity for the user to review.",
  },
  {
    command: "/orchestrate",
    label: "Orchestrate",
    description: "Run all agents",
    longDescription: "Meta-command that reads pending tasks, groups them by agent, and spawns sub-agents to execute work using their full personas and skills.",
  },
];

// ─── Daily Actions ────────────────────────────────────────────────────────────

export interface DailyAction {
  id: string;
  title: string;
  done: boolean;
  date: string;
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

// ─── Task Comments ───────────────────────────────────────────────────────────

export interface TaskComment {
  id: string;
  author: AgentRole | "system";
  content: string;
  createdAt: string;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  importance: Importance;
  urgency: Urgency;
  kanban: KanbanStatus;
  projectId: string | null;
  milestoneId: string | null;
  assignedTo: AgentRole | null;
  collaborators: string[];
  dailyActions: DailyAction[];
  subtasks: Subtask[];
  blockedBy: string[];
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  acceptanceCriteria: string[];
  comments: TaskComment[];
  tags: string[];
  notes: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  reviewed?: boolean;
}

export interface TasksFile {
  tasks: Task[];
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  timeframe: string;
  parentGoalId: string | null;
  projectId: string | null;
  status: GoalStatus;
  milestones: string[];
  tasks: string[];
  createdAt: string;
  deletedAt: string | null;
}

export interface GoalsFile {
  goals: Goal[];
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  teamMembers: string[];
  createdAt: string;
  tags: string[];
  deletedAt: string | null;
}

export interface ProjectsFile {
  projects: Project[];
}

// ─── Brain Dump ───────────────────────────────────────────────────────────────

export interface BrainDumpEntry {
  id: string;
  content: string;
  capturedAt: string;
  processed: boolean;
  convertedTo: string | null;
  tags: string[];
}

export interface BrainDumpFile {
  entries: BrainDumpEntry[];
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type EventType =
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_delegated"
  | "task_failed"
  | "message_sent"
  | "decision_requested"
  | "decision_answered"
  | "brain_dump_triaged"
  | "milestone_completed"
  | "agent_checkin";

export interface ActivityEvent {
  id: string;
  type: EventType;
  actor: AgentRole | "system";
  taskId: string | null;
  summary: string;
  details: string;
  timestamp: string;
}

export interface ActivityLogFile {
  events: ActivityEvent[];
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export type MessageType = "delegation" | "report" | "question" | "update" | "approval";
export type MessageStatus = "unread" | "read" | "archived";

export interface InboxMessage {
  id: string;
  from: AgentRole | "system";
  to: AgentRole;
  type: MessageType;
  taskId: string | null;
  subject: string;
  body: string;
  status: MessageStatus;
  createdAt: string;
  readAt: string | null;
}

export interface InboxFile {
  messages: InboxMessage[];
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export type DecisionStatus = "pending" | "answered";

export interface DecisionItem {
  id: string;
  requestedBy: AgentRole | "system";
  taskId: string | null;
  question: string;
  options: string[];
  context: string;
  status: DecisionStatus;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface DecisionsFile {
  decisions: DecisionItem[];
}

// ─── Active Runs (task execution tracking) ───────────────────────────────────

export type RunStatus = "running" | "completed" | "failed" | "timeout" | "stopped";

export interface ActiveRun {
  id: string;
  taskId: string;
  agentId: string;
  projectId: string | null;
  missionId: string | null;
  pid: number;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
  error: string | null;
  costUsd: number | null;
  numTurns: number | null;
  continuationIndex: number;
}

export interface ActiveRunsFile {
  runs: ActiveRun[];
}

// ─── Missions (continuous project execution) ─────────────────────────────────

export type MissionStatus = "running" | "completed" | "stopped" | "stalled";

export interface MissionTaskEntry {
  taskId: string;
  taskTitle: string;
  agentId: string;
  status: "completed" | "failed" | "timeout" | "stopped";
  startedAt: string;
  completedAt: string;
  summary: string;
  attempt: number;
}

export interface LoopDetectionState {
  taskAttempts: Record<string, number>;
  taskErrors: Record<string, string[]>;
}

export interface MissionRun {
  id: string;
  projectId: string;
  status: MissionStatus;
  startedAt: string;
  stoppedAt: string | null;
  completedAt: string | null;
  lastTaskCompletedAt: string | null;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  taskHistory: MissionTaskEntry[];
  loopDetection: LoopDetectionState;
}

export interface MissionsFile {
  missions: MissionRun[];
}

// ─── Eisenhower quadrant helpers ──────────────────────────────────────────────

export type EisenhowerQuadrant =
  | "do"        // important + urgent
  | "schedule"  // important + not-urgent
  | "delegate"  // not-important + urgent
  | "eliminate"; // not-important + not-urgent

export function getQuadrant(task: Task): EisenhowerQuadrant {
  if (task.importance === "important" && task.urgency === "urgent") return "do";
  if (task.importance === "important" && task.urgency === "not-urgent") return "schedule";
  if (task.importance === "not-important" && task.urgency === "urgent") return "delegate";
  return "eliminate";
}

export function quadrantFromValues(importance: Importance, urgency: Urgency): EisenhowerQuadrant {
  if (importance === "important" && urgency === "urgent") return "do";
  if (importance === "important" && urgency === "not-urgent") return "schedule";
  if (importance === "not-important" && urgency === "urgent") return "delegate";
  return "eliminate";
}

export function valuesFromQuadrant(quadrant: EisenhowerQuadrant): { importance: Importance; urgency: Urgency } {
  switch (quadrant) {
    case "do": return { importance: "important", urgency: "urgent" };
    case "schedule": return { importance: "important", urgency: "not-urgent" };
    case "delegate": return { importance: "not-important", urgency: "urgent" };
    case "eliminate": return { importance: "not-important", urgency: "not-urgent" };
  }
}
