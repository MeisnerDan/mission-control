"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Inbox, Send, User, Search, Code, Megaphone, BarChart3, Mail, MailOpen, Archive, Plus, Reply, MessageSquare, ChevronRight, ChevronDown, Loader2, Bot, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { useInbox, useTasks } from "@/hooks/use-data";
import { MessageRowSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/error-state";
import { Tip } from "@/components/ui/tip";
import { showInfo, showError as showErrorToast } from "@/lib/toast";
import type { AgentRole, InboxMessage, MessageType } from "@/lib/types";
import { AGENT_ROLES } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ─── Constants ──────────────────────────────────────────────────────────────

const agentIcons: Record<AgentRole, typeof User> = {
  me: User,
  researcher: Search,
  developer: Code,
  marketer: Megaphone,
  "business-analyst": BarChart3,
};

const typeColors: Record<MessageType, string> = {
  delegation: "bg-blue-500/20 text-blue-400",
  report: "bg-green-500/20 text-green-400",
  question: "bg-yellow-500/20 text-yellow-400",
  update: "bg-purple-500/20 text-purple-400",
  approval: "bg-orange-500/20 text-orange-400",
};

// ─── Thread Grouping ────────────────────────────────────────────────────────

interface Thread {
  key: string;
  subject: string;
  messages: InboxMessage[];
  latest: InboxMessage;
  unreadCount: number;
  participants: string[];
  taskId: string | null;
}

/** Strip "Re: " prefixes and normalize for grouping */
function normalizeSubject(s: string): string {
  return s.replace(/^(Re:\s*)+/i, "").trim().toLowerCase();
}

/** Display subject — strip "Re:" but preserve original casing from root message */
function displaySubject(messages: InboxMessage[]): string {
  // Use the earliest message's subject (the original), stripped of "Re:"
  const root = messages[0];
  return root.subject.replace(/^(Re:\s*)+/i, "").trim() || "(no subject)";
}

function groupIntoThreads(messages: InboxMessage[]): Thread[] {
  const threadMap = new Map<string, InboxMessage[]>();

  for (const msg of messages) {
    const key = normalizeSubject(msg.subject);
    if (!threadMap.has(key)) {
      threadMap.set(key, []);
    }
    threadMap.get(key)!.push(msg);
  }

  const threads: Thread[] = [];
  for (const [key, msgs] of threadMap) {
    // Sort messages chronologically (oldest first) within thread
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const latest = msgs[msgs.length - 1];
    const unreadCount = msgs.filter((m) => m.status === "unread").length;

    // Collect unique participants
    const participantSet = new Set<string>();
    for (const m of msgs) {
      participantSet.add(m.from);
      participantSet.add(m.to);
    }

    // Find a common taskId (use the most recent non-null one)
    let taskId: string | null = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].taskId) { taskId = msgs[i].taskId; break; }
    }

    threads.push({
      key,
      subject: displaySubject(msgs),
      messages: msgs,
      latest,
      unreadCount,
      participants: Array.from(participantSet),
      taskId,
    });
  }

  // Sort threads by latest message (newest first)
  threads.sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime());
  return threads;
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function InboxPage() {
  const { messages, loading, create: createMessage, update: updateMessage, error: inboxError, refetch } = useInbox();
  const { tasks } = useTasks();
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  // Compose form state
  const [composeTo, setComposeTo] = useState<AgentRole>("developer");
  const [composeType, setComposeType] = useState<MessageType>("delegation");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeTaskId, setComposeTaskId] = useState<string>("none");

  // Track which threads have pending agent responses (server-polled)
  interface RespondingInfo { runId: string; agent: string; since: number; sessionIndex: number }
  const [respondingThreads, setRespondingThreads] = useState<Map<string, RespondingInfo>>(new Map());

  // Poll /api/inbox/respond/status every 3 seconds to track active runs
  useEffect(() => {
    if (respondingThreads.size === 0) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/inbox/respond/status");
        if (!res.ok) return;
        const data = await res.json() as { runs: Array<{ id: string; messageId: string; agentId: string; continuationIndex: number; status: string }> };

        setRespondingThreads((prev) => {
          const next = new Map(prev);
          // Check each tracked thread against server state
          for (const [threadKey, info] of prev) {
            const serverRun = data.runs.find((r) => r.id === info.runId);
            if (!serverRun) {
              // Run no longer active — clear it
              next.delete(threadKey);
            } else {
              // Update session index
              if (serverRun.continuationIndex !== info.sessionIndex) {
                next.set(threadKey, { ...info, sessionIndex: serverRun.continuationIndex });
              }
            }
          }
          return next;
        });
      } catch { /* ignore poll errors */ }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [respondingThreads.size]); // Only depend on size to avoid excessive re-renders

  // Filter messages first, then group into threads
  const threads = useMemo(() => {
    let filtered = messages;

    if (filterAgent !== "all") {
      filtered = filtered.filter((m) => m.from === filterAgent || m.to === filterAgent);
    }
    if (filterStatus === "unread") {
      // Show threads that have at least one unread — filter at thread level after grouping
      const allThreads = groupIntoThreads(filtered);
      return allThreads.filter((t) => t.unreadCount > 0);
    }
    if (filterStatus === "read") {
      filtered = filtered.filter((m) => m.status === "read");
    }
    if (filterStatus === "archived") {
      filtered = filtered.filter((m) => m.status === "archived");
    }

    return groupIntoThreads(filtered);
  }, [messages, filterAgent, filterStatus]);

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  const handleMarkThreadRead = async (thread: Thread) => {
    const unread = thread.messages.filter((m) => m.status === "unread");
    await Promise.all(unread.map((m) => updateMessage(m.id, { status: "read" as const })));
  };

  const handleArchiveThread = async (thread: Thread) => {
    const nonArchived = thread.messages.filter((m) => m.status !== "archived");
    await Promise.all(nonArchived.map((m) => updateMessage(m.id, { status: "archived" as const })));
    setExpandedThread(null);
  };

  const handleReply = (msg: InboxMessage) => {
    setComposeTo(msg.from === "me" ? (msg.to as AgentRole) : (msg.from as AgentRole));
    setComposeType("update");
    setComposeSubject(msg.subject.startsWith("Re: ") ? msg.subject : `Re: ${msg.subject}`);
    setComposeTaskId(msg.taskId ?? "none");
    setComposeBody("");
    setComposeOpen(true);
  };

  const triggerAutoRespond = useCallback(async (messageId: string, agentName: string, threadKey?: string) => {
    try {
      const res = await fetch("/api/inbox/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        const data = await res.json() as { runId?: string; messageId: string };
        showInfo(`${agentName} is composing a reply...`);
        if (threadKey && data.runId) {
          setRespondingThreads((prev) => {
            const next = new Map(prev);
            next.set(threadKey, { runId: data.runId!, agent: agentName, since: Date.now(), sessionIndex: 0 });
            return next;
          });
        }
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        showErrorToast(`Auto-respond failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      showErrorToast("Failed to trigger auto-respond — is the agent available?");
    }
  }, []);

  const handleStopRespond = useCallback(async (threadKey: string) => {
    const info = respondingThreads.get(threadKey);
    if (!info) return;
    try {
      const res = await fetch("/api/inbox/respond/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: info.runId }),
      });
      if (res.ok) {
        setRespondingThreads((prev) => {
          const next = new Map(prev);
          next.delete(threadKey);
          return next;
        });
        showInfo(`Stopped ${info.agent}'s response`);
      }
    } catch {
      showErrorToast("Failed to stop agent response");
    }
  }, [respondingThreads]);

  const handleSend = useCallback(async () => {
    const created = await createMessage({
      id: `msg_${Date.now()}`,
      from: "me" as AgentRole,
      to: composeTo,
      type: composeType,
      taskId: composeTaskId === "none" ? null : composeTaskId,
      subject: composeSubject,
      body: composeBody,
      status: "unread",
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    setComposeOpen(false);
    setComposeSubject("");
    setComposeBody("");
    setComposeTaskId("none");

    if (composeTo !== "me" && created) {
      const agentLabel = AGENT_ROLES.find((r) => r.id === composeTo)?.label ?? composeTo;
      const threadKey = normalizeSubject(composeSubject);
      triggerAutoRespond(created.id, agentLabel, threadKey);
    }
  }, [createMessage, composeTo, composeType, composeSubject, composeBody, composeTaskId, triggerAutoRespond]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffMs < 60000) return "just now";
    if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m ago`;
    if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Inbox" }]} />
        <div className="space-y-2">
          <MessageRowSkeleton />
          <MessageRowSkeleton />
          <MessageRowSkeleton />
          <MessageRowSkeleton />
        </div>
      </div>
    );
  }

  if (inboxError) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Inbox" }]} />
        <ErrorState message={inboxError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Inbox" }]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Inbox
          </h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          )}
        </div>
        <Tip content="Write a new message">
          <Button size="sm" className="gap-1.5" onClick={() => setComposeOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Compose
          </Button>
        </Tip>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {AGENT_ROLES.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {threads.map((thread) => {
          const isExpanded = expandedThread === thread.key;
          const hasUnread = thread.unreadCount > 0;
          const isMulti = thread.messages.length > 1;
          const latestType = thread.latest.type;

          // Collect unique participant icons (excluding "me")
          const participantIds = thread.participants.filter((p) => p !== "me");

          return (
            <Card
              key={thread.key}
              className={`transition-all cursor-pointer ${hasUnread ? "border-primary/30 bg-primary/5" : "bg-card/50"}`}
              onClick={() => {
                // Don't collapse if the user is selecting text
                if (window.getSelection()?.toString()) return;
                setExpandedThread(isExpanded ? null : thread.key);
                if (!isExpanded) handleMarkThreadRead(thread);
              }}
            >
              <CardContent className="p-3">
                {/* Thread header row */}
                <div className="flex items-center gap-3">
                  {isMulti ? (
                    isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    hasUnread
                      ? <Mail className="h-4 w-4 text-primary shrink-0" />
                      : <MailOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <Badge className={`text-xs shrink-0 ${typeColors[latestType]}`}>
                    {latestType}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${hasUnread ? "font-semibold" : ""}`}>
                      {thread.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Participant icons */}
                    <div className="flex items-center -space-x-1">
                      {participantIds.slice(0, 3).map((pid) => {
                        const Icon = agentIcons[pid as AgentRole] ?? User;
                        return <Icon key={pid} className="h-3.5 w-3.5 text-muted-foreground" />;
                      })}
                    </div>
                    {/* Message count badge for multi-message threads */}
                    {isMulti && (
                      <Tip content={`${thread.messages.length} messages in thread`}>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 gap-0.5">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {thread.messages.length}
                        </Badge>
                      </Tip>
                    )}
                    {/* Unread badge */}
                    {hasUnread && (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                        {thread.unreadCount}
                      </Badge>
                    )}
                    {/* Responding indicator with stop button */}
                    {respondingThreads.has(thread.key) && (() => {
                      const rInfo = respondingThreads.get(thread.key)!;
                      const sessionLabel = rInfo.sessionIndex > 0 ? ` (session ${rInfo.sessionIndex + 1})` : "";
                      return (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="hidden sm:inline">{rInfo.agent} composing{sessionLabel}…</span>
                          <button
                            className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
                            title="Stop agent response"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStopRespond(thread.key);
                            }}
                          >
                            <Square className="h-2.5 w-2.5 fill-current" />
                          </button>
                        </span>
                      );
                    })()}
                    <span className="text-xs text-muted-foreground">{formatDate(thread.latest.createdAt)}</span>
                  </div>
                </div>

                {/* Expanded: show all messages in thread */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    {/* Message list */}
                    <div className="space-y-0">
                      {thread.messages.map((msg, idx) => {
                        const FromIcon = agentIcons[msg.from as AgentRole] ?? User;
                        const isLast = idx === thread.messages.length - 1;
                        return (
                          <div
                            key={msg.id}
                            className={`py-2.5 ${!isLast ? "border-b border-border/50" : ""} ${msg.status === "unread" ? "bg-primary/5 -mx-3 px-3 rounded" : ""}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <FromIcon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium">{msg.from} → {msg.to}</span>
                              <Badge className={`text-[10px] h-4 px-1 ${typeColors[msg.type]}`}>{msg.type}</Badge>
                              <span className="text-xs text-muted-foreground ml-auto">{formatDate(msg.createdAt)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap text-foreground/90 pl-5">
                              {msg.body || "(no content)"}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Thread actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Tip content="Reply to this conversation">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReply(thread.latest);
                          }}
                        >
                          <Reply className="h-3 w-3" />
                          Reply
                        </Button>
                      </Tip>
                      <Tip content={isMulti ? "Archive all messages in thread" : "Archive this message"}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveThread(thread);
                          }}
                        >
                          <Archive className="h-3 w-3" />
                          {isMulti ? "Archive All" : "Archive"}
                        </Button>
                      </Tip>
                      {/* Ask agent to respond — shown when user's message is the latest */}
                      {thread.latest.from === "me" && thread.latest.to !== "me" && (
                        <Tip content={`Ask ${AGENT_ROLES.find((r) => r.id === thread.latest.to)?.label ?? thread.latest.to} to compose a reply`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const agentLabel = AGENT_ROLES.find((r) => r.id === thread.latest.to)?.label ?? thread.latest.to;
                              triggerAutoRespond(thread.latest.id, agentLabel, thread.key);
                            }}
                          >
                            <Bot className="h-3 w-3" />
                            Ask to respond
                          </Button>
                        </Tip>
                      )}
                      {thread.taskId && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          Linked task: {tasks.find((t) => t.id === thread.taskId)?.title ?? thread.taskId}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {threads.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No messages"
            description="Messages from your AI agents and team will appear here."
          />
        )}
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Compose Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Select value={composeTo} onValueChange={(v) => setComposeTo(v as AgentRole)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_ROLES.filter((r) => r.id !== "me").map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={composeType} onValueChange={(v) => setComposeType(v as MessageType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delegation">Delegation</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link to task (optional)</Label>
              <Select value={composeTaskId} onValueChange={setComposeTaskId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="No task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No task</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message..."
                className="w-full min-h-[100px] rounded-md border bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!composeSubject.trim()} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
