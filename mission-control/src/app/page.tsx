"use client";

import { useState } from "react";
import {
  Plus, CheckSquare, Target, Lightbulb, FolderOpen, Sparkles,
  Mail, HelpCircle, Activity, User, Search, Code, Megaphone, BarChart3,
  AlertTriangle, CircleDot, ShieldAlert, Rocket, Users, Zap, Database, Square,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ProjectCardLarge } from "@/components/project-card-large";
import { GoalCard } from "@/components/goal-card";
import { EisenhowerSummary } from "@/components/eisenhower-summary";
import dynamic from "next/dynamic";

const CreateTaskDialog = dynamic(
  () => import("@/components/create-task-dialog").then((mod) => ({ default: mod.CreateTaskDialog })),
  { ssr: false }
);
const CreateProjectDialog = dynamic(
  () => import("@/components/create-project-dialog").then((mod) => ({ default: mod.CreateProjectDialog })),
  { ssr: false }
);
const CreateGoalDialog = dynamic(
  () => import("@/components/create-goal-dialog").then((mod) => ({ default: mod.CreateGoalDialog })),
  { ssr: false }
);
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDaemon } from "@/hooks/use-daemon";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import { DashboardSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/error-state";
import { Tip } from "@/components/ui/tip";
import { AGENT_ROLES } from "@/lib/types";
import type { AgentRole } from "@/lib/types";
import type { TaskFormData } from "@/components/task-form";
import { apiFetch } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const agentIcons: Record<AgentRole, typeof User> = {
  me: User,
  researcher: Search,
  developer: Code,
  marketer: Megaphone,
  "business-analyst": BarChart3,
};

export default function CommandCenterPage() {
  const { data, loading, error, refetch } = useDashboardData();
  const { isRunning: daemonRunning, status: daemonStatus, start: startDaemon, stop: stopDaemon } = useDaemon();
  const { runningTaskIds, isProjectRunning, isMissionActive, runProject, stopProject } = useActiveRuns();
  useFastTaskPoll(runningTaskIds.size > 0, refetch);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);

  // Derived data from batched /api/dashboard response
  const tasks = data?.tasks ?? [];
  const goals = data?.goals ?? [];
  const projects = data?.projects ?? [];
  const unprocessedEntries = data?.entries ?? [];
  const unreadMessages = data?.messages ?? [];
  const pendingDecisions = data?.decisions ?? [];
  const recentEvents = data?.recentActivity ?? [];
  const stats = data?.stats;

  const longTermGoals = goals.filter((g) => g.type === "long-term");
  const milestones = goals.filter((g) => g.type === "medium-term");

  // Agent workload (enhanced)
  const pendingDecisionTaskIds = new Set(
    pendingDecisions.filter((d) => d.taskId).map((d) => d.taskId as string)
  );
  const agentWorkload = AGENT_ROLES.filter((r) => r.id !== "me").map((role) => {
    const agentTasks = tasks.filter((t) => t.assignedTo === role.id && t.kanban !== "done");
    const inProgress = agentTasks.filter((t) => t.kanban === "in-progress");
    const withDeps = agentTasks.filter((t) => {
      if (!t.blockedBy || t.blockedBy.length === 0) return false;
      return t.blockedBy.some((depId) => {
        const dep = tasks.find((d) => d.id === depId);
        return dep && dep.kanban !== "done";
      });
    });
    const withDecisions = agentTasks.filter((t) => pendingDecisionTaskIds.has(t.id));
    const currentTask = inProgress[0];
    const impededCount = withDeps.length + withDecisions.length;
    const status: "idle" | "on-track" | "dependencies" | "awaiting-decision" | "overloaded" =
      agentTasks.length === 0 ? "idle" :
      agentTasks.length >= 5 ? "overloaded" :
      withDecisions.length > 0 ? "awaiting-decision" :
      withDeps.length > 0 ? "dependencies" :
      "on-track";
    return {
      ...role,
      activeCount: agentTasks.length,
      inProgressCount: inProgress.length,
      dependencyCount: withDeps.length,
      awaitingDecisionCount: withDecisions.length,
      impededCount,
      currentTask,
      status,
    };
  });

  // Attention Required items
  const doQuadrantMyTasks = tasks.filter(
    (t) => t.importance === "important" && t.urgency === "urgent" && t.assignedTo === "me" && t.kanban === "not-started"
  );
  const unreadReports = unreadMessages.filter((m) => m.type === "report");
  const recentCompletions = tasks.filter(
    (t) => t.kanban === "done" && t.assignedTo && t.assignedTo !== "me" && t.completedAt &&
    !t.reviewed &&
    (Date.now() - new Date(t.completedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
  );
  const attentionItems = [
    ...(pendingDecisions.length > 0 ? [{ key: "decisions", icon: HelpCircle, label: `${pendingDecisions.length} pending decision${pendingDecisions.length > 1 ? "s" : ""}`, href: "/decisions", color: "text-yellow-500" }] : []),
    ...(unreadReports.length > 0 ? [{ key: "reports", icon: Mail, label: `${unreadReports.length} agent report${unreadReports.length > 1 ? "s" : ""} to review`, href: "/inbox", color: "text-blue-400" }] : []),
    ...(doQuadrantMyTasks.length > 0 ? [{ key: "do-tasks", icon: ShieldAlert, label: `${doQuadrantMyTasks.length} DO-quadrant task${doQuadrantMyTasks.length > 1 ? "s" : ""} not started`, href: "/priority-matrix", color: "text-red-400" }] : []),
    ...(recentCompletions.length > 0 ? [{ key: "completions", icon: CheckSquare, label: `${recentCompletions.length} completed task${recentCompletions.length > 1 ? "s" : ""} to review`, href: "/status-board", color: "text-green-400" }] : []),
  ];

  const handleCreateTask = async (formData: TaskFormData) => {
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          dailyActions: [],
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
          acceptanceCriteria: formData.acceptanceCriteria.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      showSuccess("Task created");
      refetch();
    } catch {
      showError("Failed to create task");
    }
  };

  const handleCreateProject = async (formData: { name: string; description: string; color: string; tags: string; teamMembers?: string[] }) => {
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          status: "active",
          color: formData.color,
          teamMembers: formData.teamMembers ?? [],
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      showSuccess("Project created");
      refetch();
    } catch {
      showError("Failed to create project");
    }
  };

  const handleCreateGoal = async (formData: {
    title: string;
    type: "long-term" | "medium-term";
    timeframe: string;
    projectId: string | null;
    parentGoalId: string | null;
  }) => {
    try {
      const res = await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          type: formData.type,
          timeframe: formData.timeframe,
          parentGoalId: formData.parentGoalId,
          projectId: formData.projectId,
          status: "not-started",
          milestones: [],
          tasks: [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create goal");
      showSuccess("Goal created");
      refetch();
    } catch {
      showError("Failed to create goal");
    }
  };

  const [seeding, setSeeding] = useState(false);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed-demo", { method: "POST" });
      if (res.ok) {
        toast.success("Demo data loaded! Refreshing...");
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error("Failed to load demo data");
      }
    } catch {
      toast.error("Failed to load demo data");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[]} />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[]} />
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  // Welcome screen when workspace is empty
  const isEmpty = tasks.length === 0 && projects.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[]} />

        <div className="flex flex-col items-center justify-center py-12 md:py-20">
          <div className="text-center max-w-lg mx-auto space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Welcome to Mission Control</h1>
              <p className="text-muted-foreground mt-2">
                Your command center for supervising AI agents. Create missions, delegate tasks, and let your crew handle the rest.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-left">
              <Card
                className="cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => setShowCreateProject(true)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FolderOpen className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Create a mission</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Organize your work into projects</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => setShowCreateTask(true)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Add your first task</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Break work into actionable items</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2 bg-muted/30">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Deploy AI agents</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Assign tasks to Researcher, Developer, Marketer, or Business Analyst agents.
                      They work through Claude Code and report back here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="pt-2 border-t border-border">
              <Tip content="Populate with sample tasks, projects, and goals">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleSeedDemo}
                  disabled={seeding}
                >
                  <Database className="h-3.5 w-3.5" />
                  {seeding ? "Loading..." : "Load demo data"}
                </Button>
              </Tip>
              <p className="text-xs text-muted-foreground mt-2">
                Try Mission Control with sample projects, tasks, and agent activity
              </p>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          projects={projects}
          goals={goals}
          onSubmit={handleCreateTask}
        />
        <CreateProjectDialog
          open={showCreateProject}
          onOpenChange={setShowCreateProject}
          onSubmit={handleCreateProject}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[]} />

      {/* Mission Control Autopilot */}
      <Link href="/launch">
        <Card className={cn(
          "cursor-pointer transition-all hover:shadow-lg hover:border-primary/30",
          daemonRunning && "border-green-500/20 bg-green-500/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
                  daemonRunning ? "bg-green-500/10" : "bg-muted"
                )}>
                  <Rocket className={cn("h-4 w-4", daemonRunning ? "text-green-500" : "text-muted-foreground")} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      daemonRunning ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"
                    )} />
                    <p className="text-sm font-semibold">
                      Mission Control Autopilot
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {daemonRunning
                      ? `${daemonStatus.activeSessions.length} crew active · ${daemonStatus.stats.tasksCompleted} completed${daemonStatus.lastPollAt ? ` · Last sweep: ${formatRelativeTime(daemonStatus.lastPollAt)}` : ""}`
                      : "Autonomous task execution is disabled"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!daemonRunning ? (
                  <Tip content="Start autonomous agent processing">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 text-green-500 border-green-500/30 hover:bg-green-500/10"
                      onClick={(e) => { e.preventDefault(); startDaemon(); }}
                    >
                      <Rocket className="h-3 w-3" /> Launch
                    </Button>
                  </Tip>
                ) : (
                  <Tip content="Stop all autonomous processing">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs gap-1.5"
                      onClick={(e) => { e.preventDefault(); stopDaemon(); }}
                    >
                      <Square className="h-3 w-3" /> Stop
                    </Button>
                  </Tip>
                )}
                <span className="text-xs text-muted-foreground">View Details →</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Stats Bar */}
      <div role="region" aria-label="Stats overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.totalTasks ?? tasks.length}</p>
              <p className="text-xs text-muted-foreground">
                {stats?.inProgressTasks ?? 0} active · {stats?.doneTasks ?? 0} done
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.totalGoals ?? longTermGoals.length}</p>
              <p className="text-xs text-muted-foreground">
                {stats?.completedMilestones ?? 0}/{stats?.totalMilestones ?? milestones.length} milestones
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.activeProjects ?? projects.filter((p) => p.status === "active").length}
              </p>
              <p className="text-xs text-muted-foreground">active projects</p>
            </div>
          </CardContent>
        </Card>
        <Link href="/brain-dump">
          <Card className="bg-card/50 cursor-pointer hover:border-primary/30 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats?.unprocessedBrainDump ?? unprocessedEntries.length}</p>
                <p className="text-xs text-muted-foreground">to process</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Attention Required */}
      {attentionItems.length > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <h3 className="text-sm font-semibold text-yellow-500">Attention Required</h3>
              <Badge variant="secondary" className="text-xs tabular-nums border-yellow-500/30 text-yellow-500 ml-auto">
                {attentionItems.length}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {attentionItems.map((item) => (
                <Link key={item.key} href={item.href}>
                  <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors">
                    <item.icon className={cn("h-4 w-4 shrink-0", item.color)} />
                    <span className="text-foreground">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div role="region" aria-label="Quick actions" className="flex flex-wrap gap-2">
        <Tip content="Create a new task">
          <Button size="sm" onClick={() => setShowCreateTask(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Task
          </Button>
        </Tip>
        <Tip content="Create a new mission">
          <Button size="sm" variant="outline" onClick={() => setShowCreateProject(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Project
          </Button>
        </Tip>
        <Tip content="Create a new objective">
          <Button size="sm" variant="outline" onClick={() => setShowCreateGoal(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Goal
          </Button>
        </Tip>
      </div>

      {/* ─── Comms: Inbox + Decisions ──────────────────────────────────────── */}
      <div role="region" aria-label="Communications" className="grid gap-4 lg:grid-cols-2">
        {/* Inbox Widget */}
        <Link href="/inbox">
          <Card className="bg-card/50 cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Inbox
                </span>
                {unreadMessages.length > 0 && (
                  <Badge className="text-xs tabular-nums">
                    {unreadMessages.length} unread
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unreadMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No unread messages</p>
              ) : (
                <div className="space-y-2">
                  {unreadMessages.slice(0, 3).map((msg) => (
                    <div key={msg.id} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-xs shrink-0 px-1.5 py-0">
                        {msg.type}
                      </Badge>
                      <span className="truncate flex-1 font-medium">{msg.subject}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {msg.from}
                      </span>
                    </div>
                  ))}
                  {unreadMessages.length > 3 && (
                    <p className="text-xs text-muted-foreground/60">
                      +{unreadMessages.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Decisions Widget */}
        <Link href="/decisions">
          <Card className={cn(
            "bg-card/50 cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 h-full",
            pendingDecisions.length > 0 && "border-yellow-500/20"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-yellow-500" />
                  Decisions
                </span>
                {pendingDecisions.length > 0 && (
                  <Badge variant="secondary" className="text-xs tabular-nums border-yellow-500/30 text-yellow-500">
                    {pendingDecisions.length} pending
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDecisions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No pending decisions</p>
              ) : (
                <div className="space-y-2">
                  {pendingDecisions.slice(0, 3).map((dec) => (
                    <div key={dec.id} className="text-xs border-l-2 border-yellow-500/30 pl-2">
                      <p className="font-medium truncate">{dec.question}</p>
                      <p className="text-xs text-muted-foreground">
                        from {dec.requestedBy} · {dec.options.length} options
                      </p>
                    </div>
                  ))}
                  {pendingDecisions.length > 3 && (
                    <p className="text-xs text-muted-foreground/60">
                      +{pendingDecisions.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ─── Activity Feed + Agent Workload ────────────────────────────────── */}
      <div role="region" aria-label="Activity and agent workload" className="grid gap-4 lg:grid-cols-2">
        {/* Activity Feed */}
        <Link href="/activity">
          <Card className="bg-card/50 cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No recent activity</p>
              ) : (
                <div className="space-y-1.5">
                  {recentEvents.map((evt) => (
                    <div key={evt.id} className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                      <Badge variant="secondary" className="text-xs shrink-0 px-1.5 py-0">
                        {evt.actor}
                      </Badge>
                      <span className="truncate flex-1 text-muted-foreground">{evt.summary}</span>
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Agent Workload */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Crew Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentWorkload.map((agent) => {
                const Icon = agentIcons[agent.id];
                const statusIndicator =
                  agent.status === "idle" ? "bg-muted-foreground/40" :
                  agent.status === "overloaded" ? "bg-red-500" :
                  agent.status === "awaiting-decision" ? "bg-amber-500" :
                  agent.status === "dependencies" ? "bg-blue-500" :
                  "bg-green-500";
                const statusLabel =
                  agent.status === "idle" ? "Idle" :
                  agent.status === "overloaded" ? "Overloaded" :
                  agent.status === "awaiting-decision" ? "Awaiting Decision" :
                  agent.status === "dependencies" ? "Dependencies" :
                  "On track";
                return (
                  <Link key={agent.id} href={`/team/${agent.id}`} className="block">
                    <div className="group hover:bg-accent/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <CircleDot className={cn("h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5", statusIndicator, "rounded-full")} />
                        </div>
                        <span className="text-xs font-medium flex-1 truncate">{agent.label}</span>
                        <span className={cn("text-[10px] px-1.5 py-0 rounded-full",
                          agent.status === "idle" && "text-muted-foreground bg-muted",
                          agent.status === "on-track" && "text-green-600 dark:text-green-400 bg-green-500/10",
                          agent.status === "dependencies" && "text-blue-600 dark:text-blue-400 bg-blue-500/10",
                          agent.status === "awaiting-decision" && "text-amber-600 dark:text-amber-400 bg-amber-500/10",
                          agent.status === "overloaded" && "text-red-600 dark:text-red-400 bg-red-500/10",
                        )}>
                          {statusLabel}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                          {agent.activeCount} task{agent.activeCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {agent.currentTask && (
                        <p className="text-[11px] text-muted-foreground ml-6 mt-0.5 truncate">
                          Working on: {agent.currentTask.title}
                        </p>
                      )}
                      {agent.dependencyCount > 0 && (
                        <p className="text-[11px] text-blue-500 ml-6 mt-0.5">
                          {agent.dependencyCount} waiting on dependencies
                        </p>
                      )}
                      {agent.awaitingDecisionCount > 0 && (
                        <p className="text-[11px] text-amber-500 ml-6 mt-0.5">
                          {agent.awaitingDecisionCount} awaiting decision
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missions Section */}
      <section role="region" aria-label="Missions">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Missions
          </h2>
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.filter((p) => p.status === "active").map((project) => (
            <ProjectCardLarge key={project.id} project={project} tasks={tasks} goals={goals} isRunning={isProjectRunning(project.id)} isMissionActive={isMissionActive(project.id)} onRun={runProject} onStop={stopProject} />
          ))}
          {projects.filter((p) => p.status === "active").length === 0 && (
            <Card className="border-dashed cursor-pointer hover:border-primary/30" onClick={() => setShowCreateProject(true)}>
              <CardContent className="p-6 flex flex-col items-center justify-center text-muted-foreground">
                <Plus className="h-8 w-8 mb-2" />
                <p className="text-sm">Create your first project</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Objectives Section */}
      {longTermGoals.length > 0 && (
        <section role="region" aria-label="Long-term objectives">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Long-Term Objectives
            </h2>
            <Link href="/objectives" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {longTermGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} tasks={tasks} projects={projects} milestones={milestones} />
            ))}
          </div>
        </section>
      )}

      {/* Eisenhower + Brain Dump row */}
      <div role="region" aria-label="Eisenhower matrix and brain dump" className="grid gap-4 lg:grid-cols-2">
        <EisenhowerSummary tasks={tasks} />

        {/* Recent Brain Dump */}
        {unprocessedEntries.length > 0 && (
          <Link href="/brain-dump">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  Brain Dump
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {unprocessedEntries.length} unprocessed
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {unprocessedEntries.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2">
                      <p className="line-clamp-1">{entry.content}</p>
                    </div>
                  ))}
                  {unprocessedEntries.length > 4 && (
                    <p className="text-xs text-muted-foreground/60">
                      +{unprocessedEntries.length - 4} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Dialogs */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projects={projects}
        goals={goals}
        onSubmit={handleCreateTask}
      />
      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSubmit={handleCreateProject}
      />
      <CreateGoalDialog
        open={showCreateGoal}
        onOpenChange={setShowCreateGoal}
        projects={projects}
        goals={goals}
        onSubmit={handleCreateGoal}
      />
    </div>
  );
}
