/**
 * Demo Data Seed Script
 *
 * Populates Mission Control with sample data to showcase the app's features.
 * Run with: pnpm seed:demo
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const dataDir = join(__dirname, "..", "data");

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

// ─── Agents ─────────────────────────────────────────────────────────────────

const agents = {
  agents: [
    {
      id: "me",
      name: "Me",
      icon: "User",
      description: "Tasks I do myself — decisions, approvals, creative direction",
      instructions: "You are the owner/CEO. Your role is to make decisions, give approvals, provide creative direction, and handle relationship-building. Focus on high-leverage activities that only a human can do.",
      capabilities: ["decision-making", "approvals", "creative-direction", "relationship-building"],
      skillIds: [],
      status: "active",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "researcher",
      name: "Researcher",
      icon: "Search",
      description: "Market research, competitive analysis, evaluation",
      instructions: "You are acting as a Research Analyst. Your role is to investigate topics thoroughly and produce actionable insights for a solo software entrepreneur.\n\nSteps:\n1. Read mission-control/data/ai-context.md for current project context\n2. Search the web for the most current information on this topic\n3. Cross-reference multiple sources for accuracy\n4. Focus on practical, actionable findings\n5. Consider the solo entrepreneur context (limited time, limited budget, need for leverage)",
      capabilities: ["web-research", "competitive-analysis", "report-writing", "data-gathering", "topic-investigation"],
      skillIds: ["skill_demo_research"],
      status: "active",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "developer",
      name: "Developer",
      icon: "Code",
      description: "Implementation, bug fixes, testing, deployment",
      instructions: "You are acting as a Software Engineer. Your role is to write clean, well-tested code and handle all technical implementation tasks.\n\nBefore starting:\n1. Read mission-control/data/ai-context.md for current project context\n2. Check the project's CLAUDE.md for coding conventions\n3. Review existing code patterns before writing new code",
      capabilities: ["full-stack-development", "bug-fixes", "testing", "code-review", "deployment", "architecture"],
      skillIds: ["skill_demo_task_mgmt"],
      status: "active",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "marketer",
      name: "Marketer",
      icon: "Megaphone",
      description: "Copy, growth strategy, content, SEO",
      instructions: "You are acting as a Growth Marketing Specialist for a bootstrapped software business.\n\nCapabilities you should apply:\n- Write compelling copy for landing pages, emails, and social media\n- Analyze positioning and messaging\n- Suggest growth experiments\n- Create content outlines for blog posts and documentation",
      capabilities: ["copywriting", "growth-strategy", "content-creation", "seo", "social-media", "positioning"],
      skillIds: [],
      status: "active",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "business-analyst",
      name: "Business Analyst",
      icon: "BarChart3",
      description: "Strategy, planning, prioritization, financials",
      instructions: "You are acting as a Business Analyst and Strategist advising a solo software entrepreneur.\n\nBefore starting:\n1. Read mission-control/data/ai-context.md for a quick snapshot of current state\n2. Read mission-control/data/projects.json to understand current projects\n3. Read mission-control/data/goals.json to understand priorities",
      capabilities: ["market-analysis", "feature-prioritization", "business-modeling", "financial-projections", "strategic-planning"],
      skillIds: ["skill_demo_eisenhower"],
      status: "active",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
  ],
};

// ─── Skills Library ─────────────────────────────────────────────────────────

const skillsLibrary = {
  skills: [
    {
      id: "skill_demo_research",
      name: "Web Research",
      description: "Deep web research with structured markdown output",
      content: "# Web Research\n\nWhen performing research:\n1. Search the web for the most current information\n2. Cross-reference multiple sources for accuracy\n3. Focus on practical, actionable findings\n4. Save findings to the research/ directory as markdown\n\n## Output Format\n- Executive Summary (3-5 sentences)\n- Key Findings (bulleted list)\n- Opportunities / Risks\n- Recommended Next Steps\n- Sources (links and references)",
      agentIds: ["researcher"],
      tags: ["research", "analysis"],
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "skill_demo_eisenhower",
      name: "Eisenhower Matrix Triage",
      description: "Applies Eisenhower matrix logic to prioritize work",
      content: "# Eisenhower Matrix Triage\n\n## Quadrant Definitions\n| Quadrant | Criteria | Action |\n|----------|----------|--------|\n| DO | important + urgent | Work on immediately |\n| SCHEDULE | important + not-urgent | Block time |\n| DELEGATE | not-important + urgent | Assign to agent |\n| ELIMINATE | not-important + not-urgent | Drop or defer |\n\n## Triage Rules\n1. New tasks default to SCHEDULE unless deadline < 48 hours\n2. DELEGATE tasks should always have assignedTo set\n3. Review DO quadrant daily",
      agentIds: ["me", "business-analyst"],
      tags: ["prioritization", "eisenhower", "triage"],
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "skill_demo_task_mgmt",
      name: "Task Management",
      description: "Manages tasks in Mission Control via JSON data files",
      content: "# Task Management\n\nAll data lives in mission-control/data/ as JSON files.\n\n## Quick Reference\n- AI Context: mission-control/data/ai-context.md (read FIRST)\n- Tasks: mission-control/data/tasks.json\n- Goals: mission-control/data/goals.json\n- Projects: mission-control/data/projects.json\n\n## Creating a Task\nRequired: id, title, description, importance, urgency, kanban, assignedTo\nGenerate IDs as: task_{Date.now()}\n\n## After Any Data Modification\nRun pnpm gen:context in mission-control/ to regenerate ai-context.md",
      agentIds: ["developer", "researcher", "marketer", "business-analyst"],
      tags: ["tasks", "management", "workflow"],
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
  ],
};

// ─── Projects ────────────────────────────────────────────────────────────────

const projects = {
  projects: [
    {
      id: "proj_demo_1",
      name: "SaaS Landing Page",
      description: "Build a conversion-optimized landing page for our new SaaS product. Includes hero section, features, pricing, testimonials, and CTA.",
      status: "active",
      color: "#3b82f6",
      tags: ["marketing", "web"],
      teamMembers: ["developer", "marketer"],
      createdAt: daysAgo(14),
    },
    {
      id: "proj_demo_2",
      name: "API Integration Layer",
      description: "Create a unified API layer that connects to third-party services. Includes authentication, rate limiting, and error handling.",
      status: "active",
      color: "#8b5cf6",
      tags: ["backend", "infrastructure"],
      teamMembers: ["developer", "researcher"],
      createdAt: daysAgo(21),
    },
    {
      id: "proj_demo_3",
      name: "Q4 Marketing Campaign",
      description: "Multi-channel marketing campaign for Q4 product launch. Social media, email sequences, and content marketing.",
      status: "completed",
      color: "#10b981",
      tags: ["marketing", "growth"],
      teamMembers: ["marketer", "business-analyst"],
      createdAt: daysAgo(60),
    },
  ],
};

// ─── Goals ───────────────────────────────────────────────────────────────────

const goals = {
  goals: [
    {
      id: "goal_demo_1",
      title: "Launch SaaS product to first 100 users",
      type: "long-term",
      timeframe: "Q2 2026",
      parentGoalId: null,
      projectId: "proj_demo_1",
      status: "in-progress",
      milestones: ["mile_demo_1", "mile_demo_2", "mile_demo_3"],
      tasks: ["task_demo_1", "task_demo_2", "task_demo_5"],
      createdAt: daysAgo(30),
    },
    {
      id: "mile_demo_1",
      title: "Landing page live and collecting signups",
      type: "medium-term",
      timeframe: daysAgo(-7),
      parentGoalId: "goal_demo_1",
      projectId: "proj_demo_1",
      status: "in-progress",
      milestones: [],
      tasks: ["task_demo_1", "task_demo_2"],
      createdAt: daysAgo(14),
    },
    {
      id: "mile_demo_2",
      title: "Beta API ready for testing",
      type: "medium-term",
      timeframe: daysAgo(-21),
      parentGoalId: "goal_demo_1",
      projectId: "proj_demo_2",
      status: "not-started",
      milestones: [],
      tasks: ["task_demo_3", "task_demo_4"],
      createdAt: daysAgo(14),
    },
    {
      id: "mile_demo_3",
      title: "First 50 beta signups",
      type: "medium-term",
      timeframe: daysAgo(-30),
      parentGoalId: "goal_demo_1",
      projectId: null,
      status: "not-started",
      milestones: [],
      tasks: ["task_demo_5"],
      createdAt: daysAgo(10),
    },
    {
      id: "goal_demo_2",
      title: "Build sustainable content engine",
      type: "long-term",
      timeframe: "Q3 2026",
      parentGoalId: null,
      projectId: null,
      status: "not-started",
      milestones: [],
      tasks: ["task_demo_6"],
      createdAt: daysAgo(7),
    },
  ],
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

const tasks = {
  tasks: [
    // DO quadrant (important + urgent) — multi-agent task
    {
      id: "task_demo_1",
      title: "Design hero section for landing page",
      description: "Create a compelling hero section with headline, subheadline, CTA button, and product screenshot. Should communicate value prop in under 5 seconds.",
      importance: "important",
      urgency: "urgent",
      kanban: "in-progress",
      projectId: "proj_demo_1",
      milestoneId: "mile_demo_1",
      assignedTo: "developer",
      collaborators: ["marketer"],
      dailyActions: [],
      subtasks: [
        { id: "sub_1", title: "Write headline and subheadline copy", done: true },
        { id: "sub_2", title: "Design layout in Figma", done: true },
        { id: "sub_3", title: "Implement responsive HTML/CSS", done: false },
        { id: "sub_4", title: "Add animations and micro-interactions", done: false },
      ],
      blockedBy: [],
      estimatedMinutes: 180,
      actualMinutes: null,
      acceptanceCriteria: [
        "Hero loads in under 2 seconds",
        "CTA button is above the fold on mobile",
        "Headline communicates core value proposition",
      ],
      comments: [
        {
          id: "cmt_demo_1",
          author: "me",
          content: "Focus on \"save time\" messaging. Our users care most about efficiency.",
          createdAt: daysAgo(3),
        },
        {
          id: "cmt_demo_2",
          author: "developer",
          content: "Headline and subheadline copy are done. Moving to responsive implementation now.",
          createdAt: daysAgo(1),
        },
      ],
      tags: ["design", "frontend"],
      notes: "",
      createdAt: daysAgo(7),
      updatedAt: hoursAgo(6),
      completedAt: null,
    },
    // SCHEDULE quadrant (important + not-urgent)
    {
      id: "task_demo_2",
      title: "Set up email signup form with validation",
      description: "Add an email capture form to the landing page. Must validate email format, prevent duplicates, and store in our database.",
      importance: "important",
      urgency: "not-urgent",
      kanban: "not-started",
      projectId: "proj_demo_1",
      milestoneId: "mile_demo_1",
      assignedTo: "developer",
      collaborators: [],
      dailyActions: [],
      subtasks: [],
      blockedBy: ["task_demo_1"],
      estimatedMinutes: 120,
      actualMinutes: null,
      acceptanceCriteria: [
        "Email validation on client and server side",
        "Success/error toast notifications",
        "Duplicate email detection",
      ],
      comments: [],
      tags: ["backend", "forms"],
      notes: "Consider using a third-party form service to speed this up.",
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
      completedAt: null,
    },
    // DELEGATE quadrant (not-important + urgent)
    {
      id: "task_demo_3",
      title: "Research competitor API pricing models",
      description: "Analyze how competitors price their API access. Look at rate limits, tiers, and developer experience.",
      importance: "not-important",
      urgency: "urgent",
      kanban: "in-progress",
      projectId: "proj_demo_2",
      milestoneId: "mile_demo_2",
      assignedTo: "researcher",
      collaborators: ["business-analyst"],
      dailyActions: [],
      subtasks: [
        { id: "sub_5", title: "Identify top 5 competitors", done: true },
        { id: "sub_6", title: "Document pricing tiers", done: false },
        { id: "sub_7", title: "Analyze developer docs quality", done: false },
      ],
      blockedBy: [],
      estimatedMinutes: 90,
      actualMinutes: null,
      acceptanceCriteria: [
        "Comparison table with at least 5 competitors",
        "Price-per-request analysis",
      ],
      comments: [
        {
          id: "cmt_demo_3",
          author: "researcher",
          content: "Found 7 competitors so far. Most use tiered pricing with free tiers. Will have the full analysis ready by tomorrow.",
          createdAt: hoursAgo(8),
        },
      ],
      tags: ["research", "pricing"],
      notes: "",
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(8),
      completedAt: null,
    },
    {
      id: "task_demo_4",
      title: "Design API authentication flow",
      description: "Design the OAuth2 authentication flow for the API. Consider developer experience, security, and token management.",
      importance: "important",
      urgency: "not-urgent",
      kanban: "not-started",
      projectId: "proj_demo_2",
      milestoneId: "mile_demo_2",
      assignedTo: null,
      collaborators: [],
      dailyActions: [],
      subtasks: [],
      blockedBy: ["task_demo_3"],
      estimatedMinutes: 240,
      actualMinutes: null,
      acceptanceCriteria: [
        "OAuth2 flow diagram",
        "Token rotation strategy",
        "Rate limiting design",
      ],
      comments: [],
      tags: ["security", "architecture"],
      notes: "Depends on competitor research to inform our approach.",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
      completedAt: null,
    },
    // Marketing task
    {
      id: "task_demo_5",
      title: "Write launch announcement blog post",
      description: "Write a blog post announcing the product launch. Include product screenshots, key features, and early-access signup link.",
      importance: "important",
      urgency: "not-urgent",
      kanban: "not-started",
      projectId: "proj_demo_1",
      milestoneId: "mile_demo_3",
      assignedTo: "marketer",
      collaborators: [],
      dailyActions: [],
      subtasks: [],
      blockedBy: ["task_demo_1"],
      estimatedMinutes: 120,
      actualMinutes: null,
      acceptanceCriteria: [
        "1000-1500 word blog post",
        "Include 3+ product screenshots",
        "SEO optimized title and meta description",
      ],
      comments: [],
      tags: ["content", "launch"],
      notes: "",
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      completedAt: null,
    },
    // Completed task
    {
      id: "task_demo_6",
      title: "Analyze content marketing strategy options",
      description: "Research and recommend a content strategy: blog, YouTube, Twitter threads, or newsletter. Include effort estimates and expected ROI.",
      importance: "not-important",
      urgency: "not-urgent",
      kanban: "done",
      projectId: null,
      milestoneId: null,
      assignedTo: "business-analyst",
      collaborators: ["researcher"],
      dailyActions: [],
      subtasks: [
        { id: "sub_8", title: "Research channel options", done: true },
        { id: "sub_9", title: "Estimate effort per channel", done: true },
        { id: "sub_10", title: "Create recommendation doc", done: true },
      ],
      blockedBy: [],
      estimatedMinutes: 90,
      actualMinutes: 75,
      acceptanceCriteria: [
        "Comparison of at least 4 channels",
        "ROI estimates for each",
        "Clear recommendation with rationale",
      ],
      comments: [
        {
          id: "cmt_demo_4",
          author: "business-analyst",
          content: "Completed the analysis. Recommending a blog + Twitter thread combo. Newsletter can wait until we have 500+ signups. Full report attached to the task notes.",
          createdAt: daysAgo(2),
        },
      ],
      tags: ["strategy", "content"],
      notes: "Recommendation: Start with weekly blog posts + Twitter thread repurposing. Newsletter when audience exceeds 500 subscribers.",
      createdAt: daysAgo(10),
      updatedAt: daysAgo(2),
      completedAt: daysAgo(2),
    },
    // DO quadrant for me
    {
      id: "task_demo_7",
      title: "Review and approve landing page design",
      description: "Review the developer's landing page implementation and provide feedback. Approve or request changes.",
      importance: "important",
      urgency: "urgent",
      kanban: "not-started",
      projectId: "proj_demo_1",
      milestoneId: "mile_demo_1",
      assignedTo: "me",
      collaborators: [],
      dailyActions: [],
      subtasks: [],
      blockedBy: ["task_demo_1"],
      estimatedMinutes: 30,
      actualMinutes: null,
      acceptanceCriteria: [
        "Design reviewed against brand guidelines",
        "Mobile responsiveness verified",
        "CTA placement approved",
      ],
      comments: [],
      tags: ["review"],
      notes: "",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
      completedAt: null,
    },
  ],
};

// ─── Brain Dump ──────────────────────────────────────────────────────────────

const brainDump = {
  entries: [
    {
      id: "bd_demo_1",
      content: "Could we add a referral program? Give users a unique link and reward them for signups.",
      capturedAt: daysAgo(2),
      processed: false,
      convertedTo: null,
      tags: ["growth", "idea"],
    },
    {
      id: "bd_demo_2",
      content: "Look into Stripe for payment processing. Need to compare with Paddle for international taxes.",
      capturedAt: daysAgo(1),
      processed: false,
      convertedTo: null,
      tags: ["payments"],
    },
    {
      id: "bd_demo_3",
      content: "Add dark mode toggle to the landing page \u2014 match the Mission Control vibe.",
      capturedAt: hoursAgo(4),
      processed: false,
      convertedTo: null,
      tags: ["design"],
    },
    {
      id: "bd_demo_4",
      content: "Competitor X just raised $5M. Check their new features and positioning.",
      capturedAt: daysAgo(3),
      processed: true,
      convertedTo: "task_demo_3",
      tags: ["competitive-analysis"],
    },
  ],
};

// ─── Inbox ───────────────────────────────────────────────────────────────────

const inbox = {
  messages: [
    {
      id: "msg_demo_1",
      from: "system",
      to: "developer",
      type: "delegation",
      taskId: "task_demo_1",
      subject: "New assignment: Design hero section for landing page",
      body: "You have been assigned to: \"Design hero section for landing page\"\n\nCreate a compelling hero section with headline, subheadline, CTA button, and product screenshot.",
      status: "read",
      createdAt: daysAgo(7),
      readAt: daysAgo(7),
    },
    {
      id: "msg_demo_1b",
      from: "system",
      to: "marketer",
      type: "delegation",
      taskId: "task_demo_1",
      subject: "Collaborator assignment: Design hero section for landing page",
      body: "You have been added as a collaborator on: \"Design hero section for landing page\"\n\nWork with the developer (lead) to create compelling hero copy and CTA messaging.",
      status: "read",
      createdAt: daysAgo(7),
      readAt: daysAgo(6),
    },
    {
      id: "msg_demo_2",
      from: "business-analyst",
      to: "me",
      type: "report",
      taskId: "task_demo_6",
      subject: "Completed: Analyze content marketing strategy options",
      body: "Task \"Analyze content marketing strategy options\" has been completed.\n\nRecommendation: Start with weekly blog posts + Twitter thread repurposing. Newsletter when audience exceeds 500 subscribers.\n\nKey findings:\n- Blog posts have the best long-term SEO value\n- Twitter threads can be repurposed from blog content with minimal effort\n- Newsletter requires a critical mass of subscribers to justify the effort",
      status: "unread",
      createdAt: daysAgo(2),
      readAt: null,
    },
    {
      id: "msg_demo_3",
      from: "researcher",
      to: "me",
      type: "update",
      taskId: "task_demo_3",
      subject: "Progress update: API pricing research",
      body: "Halfway through the competitor API pricing analysis. Found 7 competitors with public pricing.\n\nEarly observation: most offer a free tier with 1000 requests/month. Paid tiers range from $29-$99/month.\n\nWill have the full comparison ready by tomorrow.",
      status: "unread",
      createdAt: hoursAgo(8),
      readAt: null,
    },
    {
      id: "msg_demo_4",
      from: "system",
      to: "marketer",
      type: "delegation",
      taskId: "task_demo_5",
      subject: "New assignment: Write launch announcement blog post",
      body: "You have been assigned to: \"Write launch announcement blog post\"\n\nWrite a blog post announcing the product launch. Include product screenshots, key features, and early-access signup link.",
      status: "unread",
      createdAt: daysAgo(3),
      readAt: null,
    },
  ],
};

// ─── Activity Log ────────────────────────────────────────────────────────────

const activityLog = {
  events: [
    {
      id: "evt_demo_1",
      type: "task_created",
      actor: "system",
      taskId: "task_demo_1",
      summary: "Task created: Design hero section for landing page",
      details: "New task created and assigned to developer with marketer as collaborator.",
      timestamp: daysAgo(7),
    },
    {
      id: "evt_demo_2",
      type: "task_delegated",
      actor: "system",
      taskId: "task_demo_1",
      summary: "Task delegated to developer: Design hero section for landing page",
      details: "\"Design hero section for landing page\" was assigned to developer with marketer collaborating.",
      timestamp: daysAgo(7),
    },
    {
      id: "evt_demo_3",
      type: "task_updated",
      actor: "developer",
      taskId: "task_demo_1",
      summary: "Task started: Design hero section for landing page",
      details: "Developer began working on the hero section. Copy subtasks completed.",
      timestamp: daysAgo(3),
    },
    {
      id: "evt_demo_4",
      type: "task_delegated",
      actor: "system",
      taskId: "task_demo_3",
      summary: "Task delegated to researcher: Research competitor API pricing models",
      details: "\"Research competitor API pricing models\" was assigned to researcher with business-analyst collaborating.",
      timestamp: daysAgo(5),
    },
    {
      id: "evt_demo_5",
      type: "task_completed",
      actor: "business-analyst",
      taskId: "task_demo_6",
      summary: "Task completed: Analyze content marketing strategy options",
      details: "\"Analyze content marketing strategy options\" was marked as done by business-analyst.",
      timestamp: daysAgo(2),
    },
    {
      id: "evt_demo_6",
      type: "task_delegated",
      actor: "system",
      taskId: "task_demo_5",
      summary: "Task delegated to marketer: Write launch announcement blog post",
      details: "\"Write launch announcement blog post\" was assigned to marketer.",
      timestamp: daysAgo(3),
    },
    {
      id: "evt_demo_7",
      type: "agent_checkin",
      actor: "researcher",
      taskId: "task_demo_3",
      summary: "Researcher check-in: API pricing research 50% complete",
      details: "Found 7 competitors with public pricing. Compiling comparison table.",
      timestamp: hoursAgo(8),
    },
  ],
};

// ─── Decisions ───────────────────────────────────────────────────────────────

const decisions = {
  decisions: [
    {
      id: "dec_demo_1",
      requestedBy: "developer",
      taskId: "task_demo_1",
      question: "Which animation library should we use for the hero section?",
      options: ["Framer Motion (full-featured, larger bundle)", "CSS animations only (lightweight, limited)", "GSAP (powerful, commercial license)"],
      context: "The hero section needs smooth entrance animations and scroll-triggered effects. Framer Motion integrates well with React but adds ~30kb. CSS-only is lighter but harder to maintain complex sequences.",
      status: "pending",
      answer: null,
      answeredAt: null,
      createdAt: daysAgo(1),
    },
    {
      id: "dec_demo_2",
      requestedBy: "marketer",
      taskId: "task_demo_5",
      question: "What tone should the launch blog post use?",
      options: ["Professional/Enterprise (trust-focused)", "Casual/Developer-friendly (approachable)", "Bold/Visionary (thought-leadership)"],
      context: "Our target audience is technical founders and solo developers. The tone will set expectations for all future content. Competitors tend toward corporate language.",
      status: "pending",
      answer: null,
      answeredAt: null,
      createdAt: hoursAgo(12),
    },
  ],
};

// ─── Tasks Archive (empty for demo) ─────────────────────────────────────────

const tasksArchive = {
  tasks: [],
};

// ─── Field Ops: Services (saved but not connected) ──────────────────────────

const fieldServices = {
  services: [
    {
      id: "twitter",
      name: "Twitter / X",
      mcpPackage: "@mbelinky/x-mcp-server",
      status: "disconnected",
      authType: "oauth2",
      credentialId: null,
      riskLevel: "medium",
      capabilities: ["post-tweets", "search", "analytics", "reply", "delete"],
      allowedAgents: [],
      config: {},
      catalogId: "twitter",
      installedAt: daysAgo(3),
      lastUsed: null,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      mcpPackage: "mcp-linkedin",
      status: "disconnected",
      authType: "oauth2",
      credentialId: null,
      riskLevel: "medium",
      capabilities: ["post-updates", "company-pages", "analytics", "messaging"],
      allowedAgents: [],
      config: {},
      catalogId: "linkedin",
      installedAt: daysAgo(3),
      lastUsed: null,
    },
    {
      id: "reddit",
      name: "Reddit",
      mcpPackage: null,
      status: "disconnected",
      authType: "oauth2",
      credentialId: null,
      riskLevel: "medium",
      capabilities: ["post-to-subreddit", "comment", "reply", "search", "monitor-mentions"],
      allowedAgents: [],
      config: {},
      catalogId: "reddit",
      installedAt: daysAgo(3),
      lastUsed: null,
    },
  ],
};

// ─── Field Ops: Missions ────────────────────────────────────────────────────

const fieldMissions = {
  missions: [
    {
      id: "fmission_demo_1",
      title: "First Mission: Share Your Stack",
      description: "Your first Field Ops mission. These are pre-loaded posts about Mission Control — yes, we know. Edit them, rewrite them, or use them as-is. The point is to walk through the workflow: approve a task, connect a service, hit execute. If you happen to tell someone about MC along the way... we won't complain.",
      status: "active",
      autonomyLevel: "approve-high-risk",
      linkedProjectId: null,
      tasks: ["ftask_demo_1", "ftask_demo_2", "ftask_demo_3", "ftask_demo_4", "ftask_demo_5", "ftask_demo_6"],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      completedAt: null,
    },
  ],
};

// ─── Field Ops: Tasks ───────────────────────────────────────────────────────

const fieldTasks = {
  tasks: [
    {
      id: "ftask_demo_1",
      missionId: "fmission_demo_1",
      title: "Post on X: Discovery",
      description: "A short post about discovering Mission Control. Edit the text to match your voice before approving.",
      type: "social-post",
      serviceId: "twitter",
      assignedTo: null,
      status: "pending-approval",
      approvalRequired: true,
      payload: { operation: "create-post", text: "found an open-source tool that gives my AI agents actual structure — task queues, inboxes, reporting. been running Claude Code agents through it and I can finally see what they're all doing. github.com/MeisnerDan/mission-control", media: [] },
      result: {},
      attachments: [],
      linkedTaskId: null,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      executedAt: null,
      completedAt: null,
    },
    {
      id: "ftask_demo_2",
      missionId: "fmission_demo_1",
      title: "Post on X: Why it matters",
      description: "A post about the core problem MC solves. Rewrite in your voice or skip it.",
      type: "social-post",
      serviceId: "twitter",
      assignedTo: null,
      status: "draft",
      approvalRequired: true,
      payload: { operation: "create-post", text: "the problem with AI agent swarms isn't that they're slow. it's that you have no idea what they're doing. Mission Control gives you visibility without killing their autonomy. been the missing piece for me.", media: [] },
      result: {},
      attachments: [],
      linkedTaskId: null,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      executedAt: null,
      completedAt: null,
    },
    {
      id: "ftask_demo_3",
      missionId: "fmission_demo_1",
      title: "LinkedIn: Managing AI agents",
      description: "A LinkedIn post about managing AI agents. Edit freely — LinkedIn rewards your authentic voice.",
      type: "social-post",
      serviceId: "linkedin",
      assignedTo: null,
      status: "draft",
      approvalRequired: true,
      payload: { operation: "create-post", text: "Been experimenting with autonomous AI agents for my projects. The biggest challenge isn't getting them to work — it's knowing what they're working on.\n\nI started using Mission Control, an open-source tool that gives AI agents roles, task queues, and reporting workflows. Think of it as a project manager for your agent swarm.\n\nEarly days, but the visibility alone has been worth it. Runs entirely locally — no cloud dependency.\n\ngithub.com/MeisnerDan/mission-control" },
      result: {},
      attachments: [],
      linkedTaskId: null,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      executedAt: null,
      completedAt: null,
    },
    {
      id: "ftask_demo_4",
      missionId: "fmission_demo_1",
      title: "Reddit: r/SideProject share",
      description: "A sideproject share. Edit to tell your own story — Reddit values authenticity.",
      type: "social-post",
      serviceId: "reddit",
      assignedTo: null,
      status: "draft",
      approvalRequired: true,
      payload: { operation: "submit-post", subreddit: "SideProject", title: "I built an open-source command center for managing AI agents", text: "I'm a solo founder with way too many ideas and not enough hours. I've been using Claude Code agents to handle research, development, and marketing tasks — but managing the agents themselves became its own full-time job.\n\nSo I built Mission Control: Eisenhower matrix for prioritization, Kanban boards, agent inboxes, and a Field Ops system that lets agents execute real actions (social posts, payments, API calls) with approval workflows.\n\nRuns locally, no cloud, no accounts. AGPL-3.0 licensed.\n\ngithub.com/MeisnerDan/mission-control" },
      result: {},
      attachments: [],
      linkedTaskId: null,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      executedAt: null,
      completedAt: null,
    },
    {
      id: "ftask_demo_5",
      missionId: "fmission_demo_1",
      title: "Reddit: r/ClaudeAI share",
      description: "A post for the Claude community. Edit to match how you actually use Claude.",
      type: "social-post",
      serviceId: "reddit",
      assignedTo: null,
      status: "draft",
      approvalRequired: true,
      payload: { operation: "submit-post", subreddit: "ClaudeAI", title: "Built a local task manager that orchestrates Claude Code agents", text: "If you're running multiple Claude Code sessions with claude -p, you know the pain — no central view of what's running, what finished, what failed.\n\nMission Control gives each agent a role, an inbox, and reporting protocols. There's a daemon that polls for tasks and spawns Claude Code sessions automatically. Agents check in, post completion reports, and escalate decisions to you.\n\nAll JSON-based, runs locally, open source.\n\ngithub.com/MeisnerDan/mission-control" },
      result: {},
      attachments: [],
      linkedTaskId: null,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      executedAt: null,
      completedAt: null,
    },
    {
      id: "ftask_demo_6",
      missionId: "fmission_demo_1",
      title: "Post on X: Casual follow-up",
      description: "A casual follow-up post. Works best after you've used MC for a bit — edit with your real experience.",
      type: "social-post",
      serviceId: "twitter",
      assignedTo: null,
      status: "draft",
      approvalRequired: true,
      payload: { operation: "create-post", text: "the part where AI agents report back to your inbox with what they actually did? that's the feature I didn't know I needed. github.com/MeisnerDan/mission-control", media: [] },
      result: {},
      attachments: [],
      linkedTaskId: null,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      executedAt: null,
      completedAt: null,
    },
  ],
};

// ─── Field Ops: Activity Log ────────────────────────────────────────────────

const fieldActivityLog = {
  events: [
    {
      id: "fev_demo_1",
      type: "field_task_created",
      actor: "system",
      taskId: "ftask_demo_1",
      serviceId: "twitter",
      missionId: "fmission_demo_1",
      credentialId: null,
      metadata: null,
      summary: "Mission created: First Mission: Share Your Stack",
      details: "6 field tasks queued across X, LinkedIn, and Reddit",
      timestamp: daysAgo(2),
    },
    {
      id: "fev_demo_2",
      type: "field_task_created",
      actor: "system",
      taskId: "ftask_demo_1",
      serviceId: "twitter",
      missionId: "fmission_demo_1",
      credentialId: null,
      metadata: null,
      summary: "Task awaiting approval: Post on X — Discovery",
      details: "Connect X and approve to execute",
      timestamp: daysAgo(2),
    },
  ],
};

// ─── Write all files ─────────────────────────────────────────────────────────

const fieldOpsDir = join(dataDir, "field-ops");
if (!existsSync(fieldOpsDir)) {
  mkdirSync(fieldOpsDir, { recursive: true });
}

const files: Record<string, unknown> = {
  "agents.json": agents,
  "skills-library.json": skillsLibrary,
  "tasks.json": tasks,
  "tasks-archive.json": tasksArchive,
  "goals.json": goals,
  "projects.json": projects,
  "brain-dump.json": brainDump,
  "inbox.json": inbox,
  "activity-log.json": activityLog,
  "decisions.json": decisions,
};

const fieldOpsFiles: Record<string, unknown> = {
  "services.json": fieldServices,
  "missions.json": fieldMissions,
  "tasks.json": fieldTasks,
  "activity-log.json": fieldActivityLog,
};

for (const [filename, data] of Object.entries(files)) {
  const filePath = join(dataDir, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  \u2713 ${filename}`);
}

for (const [filename, data] of Object.entries(fieldOpsFiles)) {
  const filePath = join(fieldOpsDir, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  \u2713 field-ops/${filename}`);
}

console.log("\n\uD83D\uDE80 Demo data seeded successfully!");
console.log("   Start the dev server with: pnpm dev");
console.log("   Then open http://localhost:3000 to see the demo.\n");
