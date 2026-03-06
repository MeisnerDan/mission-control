"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  X, Trash2, ListChecks, Link2, CheckCircle2, Rocket,
  Send, Clock, MessageSquare, Activity, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm, type TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Task, Project, Goal, AgentRole, TaskComment } from "@/lib/types";
import { getQuadrant } from "@/lib/types";
import { useActivityLog, useInbox, useAgents, useDecisions } from "@/hooks/use-data";
import { getAgentIcon } from "@/lib/agent-icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

const quadrantLabels: Record<string, { label: string; color: string }> = {
  do: { label: "DO", color: "bg-quadrant-do/20 text-quadrant-do border-quadrant-do/30" },
  schedule: { label: "SCHEDULE", color: "bg-quadrant-schedule/20 text-quadrant-schedule border-quadrant-schedule/30" },
  delegate: { label: "DELEGATE", color: "bg-quadrant-delegate/20 text-quadrant-delegate border-quadrant-delegate/30" },
  eliminate: { label: "ELIMINATE", color: "bg-quadrant-eliminate/20 text-quadrant-eliminate border-quadrant-eliminate/30" },
};

interface TaskDetailPanelProps {
  task: Task;
  projects: Project[];
  goals: Goal[];
  allTasks?: Task[];
  onUpdate: (data: TaskFormData) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailPanel({ task, projects, goals, allTasks, onUpdate, onDelete, onClose }: TaskDetailPanelProps) {
  const { events } = useActivityLog();
  const { messages } = useInbox();
  const { agents } = useAgents();
  const { decisions } = useDecisions();
  const [commentText, setCommentText] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const activeAgents = agents.filter((a) => a.status === "active");
  const deployableAgents = activeAgents.filter((a) => a.id !== "me");

  // Focus management: move focus into panel on open, restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, [task]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleUpdate = useCallback(
    (data: TaskFormData) => {
      onUpdate(data);
      onClose();
    },
    [onUpdate, onClose]
  );

  const handleDeploy = useCallback(
    (role: AgentRole) => {
      const deployData: TaskFormData = {
        title: task.title,
        description: task.description,
        importance: task.importance,
        urgency: task.urgency,
        kanban: task.kanban === "not-started" ? "in-progress" : task.kanban,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
        assignedTo: role,
        collaborators: task.collaborators ?? [],
        tags: task.tags.join(", "),
        notes: task.notes,
        subtasks: task.subtasks ?? [],
        blockedBy: task.blockedBy ?? [],
        estimatedMinutes: task.estimatedMinutes ?? null,
        dueDate: task.dueDate ?? null,
        acceptanceCriteria: (task.acceptanceCriteria ?? []).join("\n"),
      };
      const agent = agents.find((a) => a.id === role);
      const agentLabel = agent?.name ?? role;
      toast.success(`Deployed to ${agentLabel}`, { icon: "🚀" });
      onUpdate(deployData);
      onClose();
    },
    [task, agents, onUpdate, onClose]
  );

  const handleMarkReviewed = useCallback(async () => {
    try {
      await apiFetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, reviewed: true }),
      });
      toast.success("Marked as reviewed");
      onClose();
    } catch {
      toast.error("Failed to mark reviewed");
    }
  }, [task.id, onClose]);

  const handleAddComment = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    const newComment: TaskComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: "me",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const existingComments = task.comments ?? [];
    try {
      await apiFetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          comments: [...existingComments, newComment],
        }),
      });
      // Optimistically update the local task reference
      task.comments = [...existingComments, newComment];
      setCommentText("");
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    }
  }, [commentText, task]);

  const quadrant = getQuadrant(task);
  const qi = quadrantLabels[quadrant];
  const project = projects.find((p) => p.id === task.projectId);

  // Summary stats
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const depCount = task.blockedBy?.length ?? 0;
  const unmetDepCount = allTasks
    ? (task.blockedBy ?? []).filter((depId) => {
        const dep = allTasks.find((t) => t.id === depId);
        return dep && dep.kanban !== "done";
      }).length
    : depCount;
  const hasAwaitingDecision = decisions.some(
    (d) => d.taskId === task.id && d.status === "pending"
  );
  const criteriaCount = task.acceptanceCriteria?.length ?? 0;

  // Timeline: merge activity events + inbox messages for this task
  const taskEvents = events
    .filter((e) => e.taskId === task.id)
    .map((e) => ({
      id: e.id,
      type: "event" as const,
      actor: e.actor,
      summary: e.summary,
      timestamp: e.timestamp,
    }));
  const taskMessages = messages
    .filter((m) => m.taskId === task.id)
    .map((m) => ({
      id: m.id,
      type: "message" as const,
      actor: m.from,
      summary: `${m.type}: ${m.subject}`,
      timestamp: m.createdAt,
    }));
  const timeline = [...taskEvents, ...taskMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Comments
  const comments = task.comments ?? [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Task details"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-full md:max-w-lg flex-col border-l bg-card shadow-2xl animate-in slide-in-from-right duration-200 outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", qi.color)}>
              {qi.label}
            </Badge>
            {project && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: project.color, color: project.color }}
              >
                {project.name}
              </Badge>
            )}
            {/* Quick stats badges */}
            {subtaskCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ListChecks className="h-3 w-3" />
                {subtaskDone}/{subtaskCount}
              </Badge>
            )}
            {depCount > 0 && (
              <Badge variant="secondary" className={cn("text-xs gap-1", unmetDepCount > 0 ? "border-blue-500/30 text-blue-500" : "")}>
                <Link2 className="h-3 w-3" />
                {unmetDepCount > 0 ? `${unmetDepCount} pending dep${unmetDepCount > 1 ? "s" : ""}` : `${depCount} dep${depCount > 1 ? "s" : ""}`}
              </Badge>
            )}
            {hasAwaitingDecision && (
              <Badge variant="secondary" className="text-xs gap-1 border-amber-500/30 text-amber-500">
                <Clock className="h-3 w-3" />
                Awaiting Decision
              </Badge>
            )}
            {criteriaCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {criteriaCount} criteria
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Mark reviewed button — shown for done agent tasks not yet reviewed */}
            {task.kanban === "done" && task.assignedTo && task.assignedTo !== "me" && !task.reviewed && (
              <Tip content="Mark as reviewed — removes from Attention Required">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-green-500 hover:bg-green-500/10"
                  aria-label="Mark as reviewed"
                  onClick={handleMarkReviewed}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </Tip>
            )}
            {/* Deploy button */}
            <DropdownMenu>
              <Tip content="Deploy to agent">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:bg-primary/10"
                    aria-label="Deploy to agent"
                  >
                    <Rocket className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {deployableAgents.map((agent) => {
                  const Icon = getAgentIcon(agent.id, agent.icon);
                  const isCurrentAssignee = task.assignedTo === agent.id;
                  return (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => handleDeploy(agent.id)}
                      className={cn(isCurrentAssignee && "bg-accent")}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span className="flex-1">{agent.name}</span>
                      {isCurrentAssignee && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                          active
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tip content="Delete task">
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)} aria-label="Delete task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tip>
            <Tip content="Close panel">
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Tip>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
          {/* Form */}
          <TaskForm
            initial={{
              title: task.title,
              description: task.description,
              importance: task.importance,
              urgency: task.urgency,
              kanban: task.kanban,
              projectId: task.projectId,
              milestoneId: task.milestoneId,
              assignedTo: task.assignedTo,
              collaborators: task.collaborators ?? [],
              tags: task.tags.join(", "),
              notes: task.notes,
              subtasks: task.subtasks ?? [],
              blockedBy: task.blockedBy ?? [],
              estimatedMinutes: task.estimatedMinutes ?? null,
              dueDate: task.dueDate ?? null,
              acceptanceCriteria: (task.acceptanceCriteria ?? []).join("\n"),
            }}
            projects={projects}
            goals={goals}
            allTasks={allTasks}
            currentTaskId={task.id}
            onSubmit={handleUpdate}
            onCancel={onClose}
            submitLabel="Save Changes"
          />

          {/* Comments Thread */}
          <Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:text-foreground text-muted-foreground transition-colors">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">
                Comments {comments.length > 0 && `(${comments.length})`}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Existing comments */}
              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const authorAgent = agents.find((a) => a.id === comment.author);
                    const AuthorIcon = comment.author === "system" ? Activity : getAgentIcon(comment.author, authorAgent?.icon);
                    return (
                      <div key={comment.id} className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <AuthorIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {comment.author === "system" ? "System" : (authorAgent?.name ?? comment.author)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No comments yet</p>
              )}

              {/* Add comment */}
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[60px] text-xs resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <Tip content="Post comment">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 self-end"
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                    aria-label="Send comment"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </Tip>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Activity Timeline */}
          <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:text-foreground text-muted-foreground transition-colors">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Timeline {timeline.length > 0 && `(${timeline.length})`}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {timeline.length > 0 ? (
                <div className="relative space-y-0 pl-3 border-l border-border">
                  {timeline.map((item) => {
                    const actorAgent = agents.find((a) => a.id === item.actor);
                    const ActorIcon = item.actor === "system" ? Activity : getAgentIcon(item.actor, actorAgent?.icon);
                    return (
                      <div key={item.id} className="relative pb-3 last:pb-0">
                        <div className="absolute -left-[calc(0.75rem+4.5px)] top-1 h-2 w-2 rounded-full bg-border" />
                        <div className="flex items-start gap-2">
                          <ActorIcon className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                            <p className="text-[10px] text-muted-foreground/60">
                              {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {item.type === "event" ? "activity" : "message"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No activity yet</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer timestamps */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex justify-between">
          <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
          <span>Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
          {task.estimatedMinutes && (
            <span>Est: {task.estimatedMinutes}m</span>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete task?"
        description={`"${task.title}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onDelete}
      />
    </>
  );
}
