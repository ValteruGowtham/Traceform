# ⬡ Traceform

> **Execution-Backed Code Review**

Traceform is an autonomous AI agent that doesn't just read code diffs—it checks out PR branches, executes test suites, writes targeted verification tests for changed code paths, and posts reviews to GitHub backed by actual execution traces, not hallucinations.

![Traceform Dashboard](public/dashboard-preview.png) *(Preview placeholder)*

## 🌟 Why Traceform?

Every "AI code review" tool reads diffs and pattern-matches against a static checklist. None of them actually verify their own claims by running anything—so they hallucinate bugs and miss real ones.

Traceform bridges this gap by acting like a real developer:
1. **Check out the branch**: It pulls the code locally.
2. **Read the diff**: Analyzes what changed.
3. **Run existing tests**: Ensures nothing broke.
4. **Write verification tests**: Writes temporary tests targeting edge cases in the new code.
5. **Remember conventions**: Stores decisions from past reviews in a local memory store to avoid repeating "nits" the team already dismissed.
6. **Post evidence**: Comments on the PR with actual stdout/stderr execution traces proving its claims.

## 🚀 Getting Started (Simulator)

Traceform comes with a beautiful Next.js-based interactive simulator that lets you test the agent locally without needing to set up complex GitHub webhooks or ngrok.

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ValteruGowtham/Traceform.git
   cd Traceform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 Using the Simulator

The dashboard includes 4 built-in PR scenarios to demonstrate how Traceform thinks:

1. **🐛 Real Bug**: An off-by-one error in pagination (`Math.floor` vs `Math.ceil`), caught by an agent-written test.
2. **✅ Hallucinated Bug**: A typical AI reviewer would flag a false positive; Traceform runs the tests and proves the code works perfectly.
3. **🧠 Style Dismissed**: Traceform reads repo memory and intelligently skips commenting on a style "nit" the team already resolved.
4. **⚡ Performance**: An N+1 database query is detected and confirmed via the execution trace.

Select a scenario and click **"▶ Analyze PR"** to watch the streaming execution trace in real-time.

## 🧠 Repository Memory

Traceform learns over time. It maintains a persistent JSON store (`.pr-reviewer-memory/`) for each repository to track:
- **Conventions**: Explicit team rules (e.g., "Always use `Math.ceil` for pagination").
- **Decisions**: Architectural choices made in past PRs.
- **Dismissed**: Style nits the team has explicitly chosen to ignore.

## 🔌 GitHub Webhook Integration

Traceform provides a webhook endpoint ready for GitHub integration:

- **URL**: `https://your-domain.com/api/webhook/github`
- **Events**: `pull_request` (`opened`, `synchronize`, `reopened`)

When a PR event is received, Traceform spins up an asynchronous worker to run the review loop and post inline comments back to the PR using the GitHub API.

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Custom Spatial Glassmorphism (Vanilla CSS, CSS Variables)
- **Agent Loop**: Custom simulated tool-use engine (ready to be swapped with Claude/Gemini Tool Use APIs)
- **Streaming**: Server-Sent Events (SSE) for real-time trace logs

## 📄 License

MIT
