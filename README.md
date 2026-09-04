# Portable Job Search

This folder is a local, agent-independent job-search workspace. Its data lives in CSV files, the dashboard runs entirely on your computer, and the workflow is stored as an Agent Skill.

## One-time setup

1. Install Node.js 20 or newer and npm.
2. Run `npm run init` to create local tracker CSVs and `config/preferences.json` from the repository templates.
3. Put your resume files in `resumes/master/` and fill in `config/preferences.json`. The first agent run can complete the preferences, build `resumes/content/resume-content.json`, and create candidate-specific emphasis profiles from those resumes.
4. Open this folder as the workspace in Codex, Cursor, Pi, OpenCode, Gemini CLI/Antigravity, Grok Build, or Claude Code. Review and trust the workspace configuration when prompted.
5. Choose how the agent will use your existing browser session:

   - **Chrome DevTools (recommended):** use current stable Chrome (automatic connection requires Chrome 144 or newer), open `chrome://inspect/#remote-debugging`, enable Remote Debugging, and approve the connection prompt when the agent starts the MCP server. This exposes the selected Chrome profile's open windows, so close sensitive tabs first. The included configs disable Chrome DevTools MCP usage statistics.
   - **Playwright fallback:** install the official [Playwright MCP browser extension](https://github.com/microsoft/playwright/tree/main/packages/extension#readme). The included MCP configurations run Playwright with `--extension`; approve its browser connection when requested.

   Both servers are configured so either is available, but the workflow uses only one controller on a tab at a time.
6. Pi users: the project configuration installs the third-party `pi-mcp-adapter` package after the workspace is trusted. Pi does not include a native MCP client; this adapter reads the repository's shared `.mcp.json` and exposes its servers lazily. Review the adapter before trusting it, restart Pi after first installation, and use `/mcp` to inspect the connection.
7. Sign in manually to portals that need an account—typically LinkedIn, Naukri, Cutshort, Instahyre, Wellfound, Arc.dev, and sometimes Indeed/Hirist. Never place passwords or cookies in this workspace.

Your preferences, resume content, generated resumes, application answers, and tracker CSVs are intentionally ignored by Git. The repository stores reusable templates and workflow code, while personal data remains local.

## Harness files included

- Codex CLI, desktop, and IDE extension: `.codex/config.toml`; Codex discovers `.agents/skills/job-search/` and `AGENTS.md` directly.
- Cursor: `.cursor/mcp.json`; Cursor discovers `.agents/skills/job-search/` and the root `AGENTS.md` directly.
- Pi coding agent: `.pi/settings.json`; Pi discovers `.agents/skills/job-search/` directly and loads `pi-mcp-adapter`, which consumes the shared `.mcp.json`.
- OpenCode: `opencode.json`; it discovers `.agents/skills/job-search/` and `AGENTS.md`.
- Gemini CLI: `.gemini/settings.json` and `GEMINI.md`; it discovers `.agents/skills/`.
- Antigravity: `.agents/mcp_config.json`; the skill is already under its `.agents/` workspace directory.
- Grok Build: `.grok/config.toml`, `AGENTS.md`, and a discovery shim under `.grok/skills/`.
- Claude Code: `.mcp.json`, `CLAUDE.md`, and a discovery shim under `.claude/skills/`.

The first MCP launch through `npx` downloads the server packages. Restart the harness after changing its MCP config. In Codex, `/mcp` shows the configured servers. In Pi, `/mcp` is provided by the adapter. Grok Build users should trust the project when prompted, can verify discovery with `grok inspect`, and can diagnose servers with `grok mcp doctor chrome-devtools` or `grok mcp doctor playwright`.

## Run a search

Start a fresh conversation in your chosen harness from this workspace and type:

> Run today's job search

The skill reloads all durable state, checks the configured portal roster, deduplicates against prior roles, updates the CSV tracker, drafts any application-question answers, and reports blocked sources separately.

The agent will not apply, send messages, or submit forms unless you explicitly authorize that action.

## Prepare a tailored resume

Resume content is stored once in `resumes/content/resume-content.json`. Three profiles change emphasis without rewriting your history:

- `backend-first` for conventional backend, distributed systems, platform, and infrastructure software roles;
- `balanced` for backend roles at AI companies, AI platform, developer productivity, and mixed founding roles;
- `ai-forward` for Applied AI product engineering, agentic systems, and AI developer-tools roles.

List the available profiles:

```bash
node .agents/skills/job-search/scripts/generate-resume.mjs --list-profiles
```

Generate and preview a reusable baseline:

```bash
node .agents/skills/job-search/scripts/generate-resume.mjs --profile balanced --pdf
```

For a listing, ask the agent:

> Prepare the application materials for JOB-ID

It will analyze the saved JD, create a selection file containing only approved evidence IDs, generate HTML and PDF versions, visually check the PDF, and record the result in `data/resume-builds.csv`. The HTML output is self-contained and can be opened or printed by any modern browser. Chrome, Chromium, or Edge is required for automatic PDF output; set `CHROME_PATH` if the browser is installed in a non-standard location.

## Open the tracker

From the workspace root, run:

```bash
node .agents/skills/job-search/scripts/serve-tracker.mjs
```

Open `http://127.0.0.1:4173`, click **Open data folder**, and select this workspace's `data/` directory. The browser will ask for read/write permission. The page can edit applications, unreadable JDs, search runs, source health, application Q&A, and generated-resume records. It makes a timestamped backup before saving a CSV.

The editable-folder feature works best in Chrome or Edge and requires the page to be served from localhost; opening `tracker/index.html` directly is not sufficient.

## Useful checks

```bash
node .agents/skills/job-search/scripts/tracker.mjs init
node .agents/skills/job-search/scripts/tracker.mjs validate
node .agents/skills/job-search/scripts/tracker.mjs list applications
```

To import agent-generated records safely, write a JSON object or array to a temporary file and run:

```bash
node .agents/skills/job-search/scripts/tracker.mjs upsert applications /path/to/records.json
```

Existing user-maintained application dates, statuses, and notes are protected by default. Add `--allow-user-fields` only when the user's explicit instruction updates those values.

## Configuration references

The included files follow the official documentation for [Chrome DevTools MCP existing-session connections](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md#connecting-to-a-running-chrome-instance), [Playwright MCP and extension mode](https://github.com/microsoft/playwright-mcp), [Codex project MCP configuration](https://developers.openai.com/codex/mcp), [Cursor project MCP configuration](https://cursor.com/docs/context/mcp), [Cursor Agent Skills](https://cursor.com/docs/skills), [Pi skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md), [Pi packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md), [Antigravity workspace MCP configuration](https://antigravity.google/docs/mcp), [Grok Build project MCP servers](https://docs.x.ai/build/features/mcp-servers), [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/), [Gemini CLI MCP servers](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md), and [Claude Code MCP servers](https://docs.anthropic.com/en/docs/claude-code/mcp). Pi's MCP bridge is the community-maintained [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter), because Pi itself does not ship an MCP client.
