<p align="center">
  <a href="https://github.com/MeisnerDan/mission-control/stargazers"><img src="https://img.shields.io/github/stars/MeisnerDan/mission-control?style=social" alt="GitHub Stars" /></a>&nbsp;
  <img src="https://img.shields.io/github/license/MeisnerDan/mission-control" alt="License" />&nbsp;
  <img src="https://img.shields.io/badge/version-0.10-blue" alt="Version" />&nbsp;
  <a href="https://github.com/MeisnerDan/mission-control/actions"><img src="https://img.shields.io/github/actions/workflow/status/MeisnerDan/mission-control/ci.yml?label=build" alt="Build Status" /></a>
</p>

<p align="center">
  <img src="mission-control/docs/rocket.svg" alt="Mission Control Rocket" width="80" />
</p>

<h1 align="center">Mission Control</h1>

<p align="center">
  <strong>Tame the swarm. Ship what matters.</strong><br/>
  Open-source command center for solo entrepreneurs who delegate work to AI agents.
</p>

<p align="center"><img src="mission-control/docs/demo.gif" alt="Mission Control Demo" width="800" /></p>

<div align="center">
<br/>

**Idea** · · · **Research** · · · **Go / No-Go** · · · **Build MVP** · · · **Launch**

You jot down a raw idea. Agents research the market and deliver a go/no-go report.<br/>
You give the green light. Agents build the MVP. You review it and say ship it.<br/><br/>
**They deploy the app, post to social media, run ad campaigns,<br/>set up payments, and keep it running.**<br/>
You made three decisions. They did everything else.

<br/>
</div>

---

## Why This Exists

Right now, everyone is releasing autonomous AI agents into the wild. It's a Cambrian explosion — agent swarms spinning up, executing tasks, calling APIs, moving money, posting content. It's exhilarating. It's also like herding wild horses. Powerful, untamed, and running in every direction. Credentials are leaking. Agents are operating as black boxes. Nobody can tell you what's actually running, whether it finished, or if it went off the rails three hours ago.

I'm a serial entrepreneur with way more ideas than hours in the day, and nowhere near enough resources to pursue them all traditionally. I built Mission Control because I was drowning — not in work, but in the *chaos* of trying to manage it all. I wanted my time back. Time with my family. Time actually living — not trading my finite heartbeats for a paycheck. AI agents are the greatest force multiplier a solo founder has ever had. But unleashing baby AGIs into the wild without structure? That's not leverage. That's a liability.

**Mission Control is the fenced playground where your AI agents can run wild — but safely.** It's the bridge between you and your swarm. Agents get roles, inboxes, and reporting protocols. You capture a raw idea in the brain dump, agents research it, build the MVP, and Field Ops launches it into the world — with approval workflows and spend limits at every step. You stay in control without micromanaging. You see everything. You ship what matters.

<table>
<tr>
<td align="center" width="25%">

**Prioritize**

Eisenhower matrix tells you what matters. Drag-and-drop tasks between Do, Schedule, Delegate, and Eliminate.

</td>
<td align="center" width="25%">

**Delegate**

Assign tasks to AI agents. They pick up work, execute, and post completion reports to your inbox.

</td>
<td align="center" width="25%">

**Supervise**

Dashboard, inbox, decisions queue. See every agent's workload, read their reports, answer their questions.

</td>
<td align="center" width="25%">

**Execute**

Agents don't just manage tasks — they execute real-world actions. Post tweets, send ETH, call APIs. With approval workflows and spend limits.

</td>
</tr>
</table>

> **How is this different from Linear, Asana, or Notion?** Those tools were built for humans typing into forms. Mission Control was built **agent-first** — from day one, for a world where AI agents do the work and humans make the decisions. Agents read and write tasks through a token-optimized API, report progress to your inbox, and escalate to you when they need judgment. You manage outcomes, not keystrokes. And it runs locally — no cloud dependency, no API keys leaked to third parties, no vendor lock-in.

---

## Features

- **Eisenhower Matrix** — Prioritize by importance and urgency with drag-and-drop between quadrants
- **Kanban Board** — Track work through Not Started, In Progress, and Done columns
- **Goal Hierarchy** — Long-term goals with milestone tracking, progress bars, and linked tasks
- **Brain Dump** — Capture ideas instantly, triage into tasks later
- **Agent Crew** — 6 built-in agents + create unlimited custom agents with unique instructions
- **Skills Library** — Define reusable knowledge modules and inject them into agent prompts
- **Multi-Agent Tasks** — Assign a lead agent + collaborators for team-based work
- **Orchestrator** — Run `/orchestrate` to spawn all agents on pending work simultaneously
- **Autonomous Daemon** — Background process that automatically polls tasks, spawns Claude Code sessions, enforces concurrency, and provides a real-time dashboard
- **One-Click Execution** — Press play on any task card to spawn a Claude Code session; live status indicators, success/failure toasts, and automatic completion (task → done, inbox report, activity log)
- **Session Resilience** — Agents that timeout or hit max turns automatically re-spawn continuation sessions, preserving progress in task notes and subtasks. Configurable max continuations per task and per inbox response
- **Cost & Usage Tracking** — Captures cost and full token usage (input, output, cache read, cache creation) from every Claude Code session; displayed on the Autopilot dashboard with per-task cost breakdown and running totals
- **Failure Logging** — Failed tasks generate `task_failed` activity events with error details, session count, and agent info. Failure reports are automatically posted to your inbox
- **Inbox Stop Button** — Stop an agent mid-response with a single click; kills the process tree and prevents continuation chains from spawning
- **Continuous Missions** — Run an entire project with one click; tasks auto-dispatch as others complete, respect dependency chains, and skip decision-blocked work. Real-time progress bar with stop button
- **Loop Detection** — Auto-detects agents stuck in failure loops; after 3 attempts, escalates to a user decision with options to retry differently, skip, or stop
- **Token-Optimized API** — Filtered queries, sparse field selection, 92% context compression (~50 tokens vs ~5,400)
- **Inbox & Decisions** — Full agent communication layer: delegation, reports, questions, and approvals
- **Cmd+K Search** — Global search across tasks, projects, goals, and brain dump entries
- **Error Resilience** — Error boundaries on every page with retry buttons, plus global error handler for crash recovery
- **API Pagination** — All 9 GET endpoints support `limit` and `offset` with a `meta` object (total, filtered, returned)
- **193 Automated Tests** — Vitest suite covering validation schemas, data layer operations, and full agent communication flow
- **Skills Injection** — Skills from the library are embedded into agent command files bidirectionally (agent→skill and skill→agent)
- **Accessibility** — ARIA live regions for drag-and-drop screen reader announcements, focus trapping on detail panels
- **CI Pipeline** — GitHub Actions runs typecheck, lint, build, and tests on every push and PR

### Field Ops — External Action Execution
- **64-Service Catalog** — Pre-configured services across 16 categories with setup guides
- **3 Working Adapters** — Twitter/X, Ethereum (+ MetaMask wallet signing), Reddit
- **Encrypted Vault** — AES-256-GCM encryption with scrypt key derivation
- **Financial Safety Controls** — Per-service + global spend limits, circuit breaker (master-password-protected)
- **3 Autonomy Levels** — Manual Approval, Supervised, Full Autonomy
- **Approval Workflows** — Risk classification + approval queue for high-risk actions
- **Dry Run Testing** — Validate actions without executing + auto-staleness checks
- **Mission System** — Group related tasks into missions with progress tracking
- **Emergency Stop** — Kill switch that instantly halts daemon, pauses missions, and locks the vault
- **PM2 Support** — Always-on mode with auto-restart on crash (ecosystem.config.js included)
- **Master-Password-Protected Controls** — Autonomy levels, safety limits, and daemon launch require vault password
- **Safety Dashboard** — Centralized per-service and global spend limits with circuit breaker

<p align="center">
  <img src="mission-control/docs/screenshots/eisenhower.png" alt="Eisenhower Priority Matrix" width="400" />
  <img src="mission-control/docs/screenshots/kanban.png" alt="Kanban Status Board" width="400" />
</p>
<p align="center">
  <img src="mission-control/docs/screenshots/crew.png" alt="Agent Crew Management" width="400" />
  <img src="mission-control/docs/screenshots/inbox.png" alt="Agent Inbox" width="400" />
</p>

---

## Quick Start

### Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| [Node.js](https://nodejs.org) v20+ | Runtime | [nodejs.org](https://nodejs.org) |
| [pnpm](https://pnpm.io) v9+ | Package manager | `npm install -g pnpm` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) *(recommended)* | Agent automation (Launch button, daemon, slash commands) | `npm install -g @anthropic-ai/claude-code` |

> The web UI works standalone for task management, prioritization, and goal tracking. Claude Code is needed to **execute** tasks via agents. Any AI coding tool that can access local files (Cursor, Windsurf, etc.) can also participate — see [Works With](#works-with) below.

### Install & Run

```bash
git clone https://github.com/MeisnerDan/mission-control.git
cd mission-control/mission-control   # repo folder → app folder (where package.json lives)
pnpm install
pnpm dev

# Always-on mode (optional, auto-restarts on crash)
pm2 start ecosystem.config.js
```

Open [http://localhost:3000](http://localhost:3000) and click **"Load Demo Data"** to see it in action with sample tasks, agents, and messages.

### What to Try First

1. **Explore the dashboard** — see task counts, agent workloads, and recent activity at a glance
2. **Drag tasks** on the Priority Matrix — move tasks between Do, Schedule, Delegate, and Eliminate
3. **Click a task card** to open the detail panel — edit description, subtasks, and acceptance criteria
4. **Click the 🚀 Launch button** on a task assigned to an agent — spawns a Claude Code session that executes the work (requires Claude Code)
5. **Open Claude Code in this workspace** and run `/daily-plan` to see slash commands in action

---

## How It Works

Mission Control stores all data in local JSON files. No database, no cloud dependency. AI agents interact by reading and writing these files — the same source of truth the web UI uses.

### The Agent Loop

```
1. You create a task          ──>  Assign to an agent role (e.g., Researcher)
2. Press play (or daemon)     ──>  Spawns a Claude Code session with agent persona
3. Agent executes             ──>  Does the work, updates progress
4. Mission Control completes  ──>  Auto-marks done, posts report, logs activity
5. You review                 ──>  Read reports in inbox, answer questions
```

Multiple agents can work in parallel across different tasks. **Continuous missions** take this further — click the rocket button on a project to run all tasks until done. As each task completes, the next batch auto-dispatches, respecting dependency chains and concurrency limits. If an agent gets stuck, loop detection escalates to you after 3 failures. The **daemon** (`pnpm daemon:start`) adds 24/7 background automation, polling for new tasks and running scheduled commands on cron schedules.

### Testing

Mission Control includes **193 automated tests** across 3 suites:

```bash
pnpm test        # Run all tests
pnpm check       # Typecheck + lint
pnpm verify      # Full verification: typecheck + lint + build + test
```

| Suite | Tests | Covers |
|-------|-------|--------|
| **Validation** | 90 | All 17 Zod schemas — field defaults, constraints, edge cases |
| **Daemon** | 42 | Security (credential scrubbing, path validation, binary whitelist), config loading, prompt builder, types |
| **Data Layer** | 19 | Read/write operations, file I/O, mutex safety, archive |
| **Agent Flow** | 17 | End-to-end: task creation → delegation → inbox → decisions → activity log |
| **Security** | 25 | API auth, rate limiting, token/origin validation, CSRF protection |

---

## Agent API

Every API endpoint is designed for minimal token consumption. Your agents spend tokens doing work, not parsing bloated payloads.

```bash
# Get only your in-progress tasks (~50 tokens vs ~5,400 for everything)
GET /api/tasks?assignedTo=developer&kanban=in-progress

# Sparse fields — return only what you need
GET /api/tasks?fields=id,title,kanban

# Get just the DO quadrant (important + urgent)
GET /api/tasks?quadrant=do

# Paginated results with metadata
GET /api/tasks?limit=10&offset=0
# → { data: [...], meta: { total: 47, filtered: 47, returned: 10, limit: 10, offset: 0 } }

# Compressed context — entire workspace state in ~650 tokens
# (vs ~10,000+ for raw JSON files)
pnpm gen:context  # outputs data/ai-context.md
```

```bash
# Run a single task — spawns a Claude Code session
POST /api/tasks/:id/run

# Run all eligible tasks in a project as a continuous mission
POST /api/projects/:id/run

# Stop a running mission (kills all processes, resets tasks)
POST /api/projects/:id/stop

# Stop a single running task
POST /api/tasks/:id/stop

# Get live status of all active runs
GET /api/runs

# Get mission status (with auto-reconciliation of stuck missions)
GET /api/missions

# Check status of inbox auto-respond sessions
GET /api/inbox/respond/status?messageId=msg_123

# Stop an active inbox auto-respond chain
POST /api/inbox/respond/stop
```

### Field Ops API
```bash
POST /api/field-ops/execute          # Execute a field task
POST /api/field-ops/vault/setup      # Initialize encrypted vault
GET  /api/field-ops/catalog          # Browse 64-service catalog
POST /api/field-ops/batch            # Bulk approve/reject up to 50 tasks
GET  /api/field-ops/safety-limits    # Read spend limits and budgets
PUT  /api/field-ops/safety-limits    # Update limits (requires master password)
```

All write endpoints use **Zod validation** (malformed data returns field-level errors) and **async-mutex locking** (concurrent writes from multiple agents queue safely, never corrupt data).

---

## Built-In Agents

| Role | Handles | Assign when... |
|------|---------|----------------|
| **Me** | Decisions, approvals, creative direction | Requires human judgment |
| **Researcher** | Market research, competitive analysis, evaluation | Needs investigation |
| **Developer** | Code, bug fixes, testing, deployment | Technical implementation |
| **Marketer** | Copy, growth strategy, content, SEO | Marketing/content work |
| **Business Analyst** | Strategy, planning, prioritization, financials | Analysis/strategy work |
| **Tester** | QA testing, bug reporting, performance analysis | Needs verification/testing |
| **+ Custom** | Anything you define | Create via `/crew/new` with custom instructions |

Agents are fully editable — change their name, instructions, capabilities, and linked skills at any time through the Crew UI or by editing `data/agents.json` directly.

---

## Slash Commands

Run these in any [Claude Code](https://docs.anthropic.com/en/docs/claude-code) session opened in this workspace:

| Command | Purpose |
|---------|---------|
| `/standup` | Daily standup from git + tasks + inbox + activity |
| `/daily-plan` | Top priorities + inbox check + decisions + brain dump triage |
| `/weekly-review` | Accomplishments + goal progress + stale items |
| `/orchestrate` | Coordinate all agents — spawn sub-agents for pending tasks |
| `/brainstorm` | Generate creative ideas on a topic |
| `/research` | Web research with structured markdown output |
| `/plan-feature` | Break a feature into tasks + create milestone |
| `/ship-feature` | Test, lint, commit + update task status + post report |
| `/pick-up-work` | Check inbox for new assignments, pick highest priority |
| `/report` | Post a status update or completion report |
| `/researcher` | Activate researcher agent persona |
| `/marketer` | Activate marketer agent persona |
| `/business-analyst` | Activate business analyst persona |

### Daemon Commands

```bash
pnpm daemon:start    # Start the autonomous daemon (background process)
pnpm daemon:stop     # Stop the daemon gracefully
pnpm daemon:status   # Show daemon status, active sessions, and stats
```

The daemon runs as a background Node.js process, polling `tasks.json` for pending work and spawning Claude Code sessions via `claude -p`. It enforces concurrency limits, retries failed tasks, and runs scheduled commands (daily-plan, standup, weekly-review) on cron schedules. Monitor everything from the `/daemon` dashboard.

> **Note on authentication:** The daemon spawns Claude Code directly via `claude -p` — it does not extract or transmit OAuth tokens, make raw API calls, or use the Agent SDK. Your Claude account credentials stay within Claude Code's own authentication layer, the same as running `claude -p` from your terminal. This is local automation of an official Anthropic product, not a third-party integration.

---

## Architecture

```
mission-control/              Next.js 15 web app (the visual interface)
mission-control/data/          JSON data files (the shared source of truth)
  tasks.json                   Tasks with Eisenhower + Kanban + agent assignment
  goals.json                   Long-term goals and milestones
  projects.json                Projects with team members
  agents.json                  Agent registry (profiles, instructions, capabilities)
  skills-library.json          Reusable knowledge modules for agents
  inbox.json                   Agent <-> human messages and reports
  decisions.json               Pending decisions requiring human judgment
  activity-log.json            Timestamped event log of all activity
  ai-context.md                Generated ~650-token workspace snapshot
  daemon-config.json           Daemon configuration (schedule, concurrency, etc.)
  daemon-status.json           Daemon runtime state (sessions, history, stats)
  missions.json                Continuous mission state (progress, history, loop detection)
  active-runs.json             Live task execution tracking (status, PIDs, errors)
  respond-runs.json            Inbox auto-respond chain tracking (status, PIDs, cost)
  field-ops/                   Field Ops data (tasks, missions, services, vault, activity)
    field-tasks.json           External action tasks with approval state machine
    field-missions.json        Mission groupings
    services.json              Connected service configurations
    service-catalog.json       64 pre-configured service definitions
    safety-limits.json         Spend limits + circuit breaker config
    approval-config.json       Autonomy levels and risk thresholds
    templates.json             Reusable task templates
    activity-log.json          Field Ops audit trail
mission-control/src/lib/adapters/ Service execution adapters (Twitter, Ethereum, Reddit)
mission-control/scripts/daemon/ Autonomous agent daemon (node-cron + claude -p)
mission-control/__tests__/     Automated tests (validation, data, integration, daemon)
.claude/commands/              Auto-generated slash commands per agent
scripts/                       Orchestration scripts (tmux parallel agents)
docs/                          Business plans and strategies
```

### Design Decisions

- **Local-first** — No database, no cloud, no API keys. Your data stays on your machine in plain JSON files.
- **JSON as IPC** — Humans (web UI) and agents (file reads + API) share the same source of truth. No sync layer needed.
- **BYOAI** — Works with any agent that can read files: Claude Code, Cursor, Windsurf, or a custom script.
- **Zod + Mutex** — All API writes are validated with Zod schemas and serialized with async-mutex to prevent data corruption during concurrent multi-agent operations.
- **Defense in Depth** — Field Ops uses layered security: encrypted vault (AES-256-GCM + scrypt), per-service and global spend limits, autonomy levels, approval workflows, rate limiting, and master-password-protected safety controls. Agents cannot modify security settings.

### Works With

Mission Control runs locally and integrates with AI coding tools through the filesystem and CLI:

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — Open this workspace in Claude Code to use slash commands (`/orchestrate`, `/daily-plan`, `/standup`, etc.) and let agents read/write task data directly.
- **[Claude Cowork](https://docs.anthropic.com/en/docs/claude-cowork)** — Cowork agents can use Mission Control as a tool by reading the workspace's `CLAUDE.md` and JSON data files directly — no special plugin required.
- **Any file-aware agent** — Cursor, Windsurf, or custom scripts can read the JSON data files and call the API endpoints to participate in the agent loop.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict mode) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com) |
| Components | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) |
| Drag & Drop | [@dnd-kit](https://dndkit.com) |
| Validation | [Zod](https://zod.dev) |
| Search | [cmdk](https://cmdk.paco.me) |
| Testing | [Vitest](https://vitest.dev) |
| Storage | Local JSON files (no database required) |

---

## Roadmap

- [x] Screenshots and demo GIF for README
- [x] One-click task execution with live status
- [x] Continuous Missions (run entire projects)
- [x] Loop detection with automatic escalation
- [x] Session resilience (auto-continuing agents)
- [x] Cost & usage tracking
- [x] Field Ops — External action execution with approval workflows
- [x] Encrypted credential vault (AES-256-GCM)
- [x] Financial safety controls (spend limits, circuit breaker)
- [x] 64-service catalog with setup guides
- [ ] More adapters (Stripe, Slack, GitHub, SendGrid, etc.)
- [ ] Audit log export (CSV/JSON for compliance)
- [ ] GitHub Issues sync (import issues as MC tasks)
- [ ] Mobile-friendly PWA version
- [ ] Dashboard analytics (velocity charts, burndown, agent utilization)
- [ ] Plugin system for custom integrations

Mission Control already runs 24/7 locally with PM2 (`pm2 start ecosystem.config.js`). **Want a hosted version?** Star the repo — Mission Control Cloud is on the roadmap. The self-hosted version will always remain free and open source.

See [open issues](https://github.com/MeisnerDan/mission-control/issues) for community-requested features and to vote on what matters most.

---

## Contributing

Contributions are welcome! Whether it's bug fixes, new agent integrations, UX improvements, or documentation.

1. Fork the repo
2. Create a feature branch
3. Run `pnpm verify` — typecheck, lint, build, and tests must all pass
4. Submit a PR

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for detailed guidelines, code conventions, and architecture notes.

---

## Disclaimer

I built this for myself — a solo entrepreneur trying to wrangle an ever-growing swarm of AI agents and side projects. I'm sharing it because I think others are drowning in the same chaos. It's provided **as-is**, no warranties or promises of support. Use it at your own risk. See the [LICENSE](LICENSE) file for full terms.

Mission Control is not affiliated with or endorsed by Anthropic. It automates Claude Code (an official Anthropic product) via the `claude -p` CLI — it does not access the Anthropic API directly or use the Agent SDK.

**A note on Field Ops:** These features execute real actions with real consequences — posting to social media, sending cryptocurrency, calling live APIs. Always test with dry runs first. Configure spend limits before enabling autonomy. The safety controls exist for a reason — use them.

---

## License

[AGPL-3.0](LICENSE) — free to use, modify, and self-host. If you host it as a service, share your changes.

---

<p align="center">
  <sub><strong>Tame the swarm. Ship what matters.</strong></sub>
</p>
