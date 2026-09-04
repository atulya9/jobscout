---
name: job-search
description: Run a repeatable, resume-grounded daily job search; verify listings, rank matches, deduplicate against a local tracker, capture unreadable JDs, and draft application-question answers. Use when the user says “Run today's job search”, “start today's job search”, asks for a shortlist, or asks to assess open job tabs.
---

# Job Search

Use this skill as a self-contained daily workflow. Do not depend on prior chat history: the workspace files are the source of truth.

## Start every run

1. Resolve the workspace root as the directory containing `AGENTS.md` and `data/`.
2. Read `AGENTS.md`, `config/preferences.json`, `resumes/content/resume-content.json`, all current rows in `data/applications.csv`, `data/resume-builds.csv`, and `data/search-sources.csv`. Treat the structured evidence bank as the candidate source of truth; inspect source resumes only when updating or validating that bank.
3. If the evidence bank, source resume, or essential preferences are missing, stop and ask only for those missing inputs. Otherwise begin immediately.
4. Create a run row in `data/search-runs.csv` with a stable ID such as `run-YYYY-MM-DD-HHMMSS` and status `running`.
5. Treat “Run today's job search” and close variants as direct invocation. Never ask the user to restate the workflow. A new conversation can start with only that phrase because all durable context lives here.

Use `node .agents/skills/job-search/scripts/tracker.mjs ...` for CSV updates when Node is available. It performs backups and atomic writes. If it is unavailable, edit CSV carefully while preserving the exact headers and RFC 4180 quoting.

## Search strategy

Read [platforms.md](references/platforms.md) before searching. Check every enabled source in `data/search-sources.csv`, plus relevant employer career pages and ATS boards discovered during the run.

Search in this order:

1. Direct web/search retrieval for public, indexable pages.
2. Chrome DevTools MCP connected to the user's running Chrome for authenticated portals and already-open tabs.
3. Playwright MCP extension mode as the browser fallback when Chrome DevTools cannot expose or operate a page.
4. Search snippets, alternative canonical employer/ATS pages, and structured data when the primary page fails.
5. If the full JD still cannot be read, add it to `data/applications.csv` with `jd_verified=false`; never silently discard it.

Use only one browser-control MCP on a tab at a time. Prefer Chrome DevTools for an existing logged-in session and Playwright extension mode as fallback. Do not launch an isolated browser for a source that requires the user's authenticated state unless the user explicitly accepts signing in again.

For every source, open its `base_url` from `data/search-sources.csv` and record `ok`, `partial`, `blocked`, `login-required`, or `not-checked`, with a concise failure note. Include blocked sources in the final report so the user can search them manually. Rows without a `base_url` (employer career sites, VC boards) are catch-alls: check the relevant company or portfolio pages discovered during the run.

## Candidate fit

Treat `config/preferences.json` as authoritative. Derive evidence from the resume, not assumptions. Evaluate:

- target role families, level, employment type, location, remote eligibility, relocation, compensation, and timezone;
- must-have skills versus demonstrated experience;
- responsibilities, scope, product/domain interest, company stage, and leadership expectations;
- explicit exclusions and hard constraints.

Do not reject a role merely because the title differs if the work matches. Distinguish a product/platform role involving AI from AI/LLM evaluation, annotation, red-teaming, or model-grading work. Apply location filters to actual eligibility, not only the display location.

Score each readable role from 0–100 using the weights in `config/preferences.json`. Label:

- `strong` for 80–100;
- `possible` for 65–79;
- `weak` below 65.

Only shortlist strong and possible matches unless the user asks for broader exploration. Explain every material gap.

## Resume tailoring

Read [resume-tailoring.md](references/resume-tailoring.md) before preparing application materials or generating a resume. If the candidate evidence bank or profiles must be created or updated, also read `docs/resume-data-model.md` from the workspace root.

The candidate has one structured evidence bank and three emphasis profiles: `backend-first`, `balanced`, and `ai-forward`. These are a continuum, not separate professional identities. Select the profile from the actual responsibilities—not merely the company industry or the presence of AI keywords.

For readable strong matches, determine whether the closest profile needs no tailoring, reordering, or a light summary adjustment. Generate a job-specific resume automatically only when reordering or light tailoring materially improves the application. For possible matches, recommend a profile and wait until the user selects the role or asks for application materials.

Use only approved evidence-bank bullet IDs. Never introduce a metric, technology, responsibility, project URL, or stronger claim from the JD. Save the selection and generated artifacts under `resumes/generated/`, render and inspect the PDF, then add a row to `data/resume-builds.csv`. Keep `review_status=draft` until visual and content checks pass. Resume generation never authorizes application submission.

## Verify and deduplicate

Before adding a role:

1. Prefer the canonical employer or ATS URL over aggregator URLs.
2. Confirm the posting is open and the application action resolves.
3. Confirm the candidate can apply from an allowed location. If uncertain, say so.
4. Extract title, company, location, work arrangement, role type (`Full Time`, `Contract`, `Part Time`, `Internship`, or `Freelance` when the posting states it), seniority, compensation if stated, source, canonical URL, ATS job ID, responsibilities, must-haves, and application questions.
5. Deduplicate against every row in `data/applications.csv`, including applied/rejected/skipped roles and unread JDs, by normalized canonical URL, ATS job ID, and normalized `company + role + location`. Update `last_verified` and `updated_at` instead of adding a duplicate.
6. Never overwrite user-maintained `status`, `application_date`, or `user_notes` with blanks or inferred values.
7. Set `jd_verified=true` only when the full JD was read. Otherwise set `jd_verified=false` and record `failure_reason` / `checks_attempted`.
8. Use status values exactly: `New`, `Applied`, `In process`, `Rejected`, `Skipped`, `Broken`. Agents may set `New` on first insert; later status changes belong to the user unless they state them.

Use these verification labels exactly: `chrome-verified`, `web-verified`, `jd-needed`, `blocked`, and `unverified`.

## Application questions

When a listing or application form contains specific questions:

1. Capture each question in `data/application-qa.csv`, linked by `job_id`.
2. Draft a concise, human answer grounded only in the resume, `config/preferences.json`, and files under `data/application-answers/`.
3. Record the evidence used. If personal knowledge is missing, set `answer_status` to `needs-user-input` and write a focused placeholder instead of inventing facts.
4. For project/repository questions, include the URL only if it is present in the candidate materials. Explain the problem each project solves in one or two sentences.
5. Also create or update `data/application-answers/<job_id>.md` with the questions and answers in a copyable format.
6. Do not submit an application or send a message without explicit user authorization.

The tracker page reads `data/application-qa.csv`, so every saved question and answer is visible and editable there.

## Finish the run

1. Upsert every role into `data/applications.csv` (`jd_verified=true` when the JD was read, `jd_verified=false` when it was not) and any generated or reused resume decisions into `data/resume-builds.csv`.
2. Update every checked source and complete the run row with counts and status `completed` or `partial`.
3. Run:

   `node .agents/skills/job-search/scripts/tracker.mjs validate`

4. Present a ranked shortlist with role, company, fit score, location/eligibility, why it fits, material gaps, verification method, and direct application URL.
5. Separately list unread JDs (`jd_verified=false`), blocked sources, duplicates skipped, and sources checked.
6. Keep the report actionable. Never call a role verified when only a search snippet was available.

Read [data-model.md](references/data-model.md) for file contracts and [platforms.md](references/platforms.md) for the retrieval matrix.
