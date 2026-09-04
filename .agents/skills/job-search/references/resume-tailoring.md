# Resume tailoring

Use the structured evidence bank at `resumes/content/resume-content.json`. The two source resumes are provenance, not templates to edit in place.

## Choose an emphasis

- `backend-first`: conventional backend, distributed systems, data platform, infrastructure software, and most platform roles. AI remains visible as supporting evidence.
- `balanced`: backend roles at AI companies, AI platform, developer productivity, and mixed backend/AI founding roles.
- `ai-forward`: Applied AI product engineering, agentic systems, AI developer tools, and AI-native founding roles where AI delivery is central.

Do not infer that an AI company automatically requires `ai-forward`. Choose based on the actual responsibilities and must-haves.

## Tailoring levels

- `none`: the baseline already covers the role. Reuse the most recent reviewed baseline PDF.
- `reorder`: change only profile, bullet order, skills order, project order, or section order.
- `light`: also use a concise, JD-aligned summary composed solely from existing facts.
- `custom`: add a newly approved evidence-bank statement. This requires user review before generation.

Never introduce a new metric, technology, responsibility, leadership claim, domain claim, or project URL from a JD. If a needed fact is absent, record it as an unsupported requirement or ask the user to approve a new evidence-bank entry.

## Job-specific selection file

Save job-specific inputs at `resumes/generated/<job-id>/selection.json` before generation. A minimal example:

```json
{
  "job": {
    "job_id": "ashby-example-123",
    "company": "Example",
    "role": "Senior Backend Engineer",
    "url": "https://example.com/jobs/123"
  },
  "profile_id": "backend-first",
  "tailoring": {
    "level": "reorder",
    "match_score": 88,
    "jd_keywords_used": ["distributed systems", "PostgreSQL", "reliability"],
    "change_summary": "Led with database performance and reliability evidence.",
    "unsupported_requirements": ["Deep production Go experience"],
    "review_status": "draft"
  },
  "experience": {
    "testgorilla": [
      "tg-query-optimization",
      "tg-reliability",
      "tg-data-remediation",
      "tg-legacy-retirement",
      "tg-candidate-enrichment",
      "tg-ai-standards",
      "tg-agent-review"
    ]
  }
}
```

Only include overrides that differ from the selected profile. `summary_text` is allowed for light tailoring, but it must be a truthful recombination of evidence-bank facts. Record why it changed under `tailoring.change_summary`.

## Generate and record

From the workspace root:

```bash
node .agents/skills/job-search/scripts/generate-resume.mjs --selection resumes/generated/<job-id>/selection.json --pdf
```

The script writes a self-contained HTML resume, optional PDF, and a manifest recording every selected bullet ID. Add or update the corresponding row in `data/resume-builds.csv`.

Render and inspect every new PDF before marking it `ready`. Check that it is no more than two pages, all text is readable, links work, section headings are not orphaned, and no content is clipped. A generated resume must remain `draft` until this review is complete.

## Daily-run behavior

- For a readable strong match (score 80+), choose a profile automatically.
- Generate a job-specific resume only when tailoring level is `reorder` or `light`; otherwise record the reusable baseline.
- For possible matches, recommend the profile but generate only when the user selects the role or asks for application materials.
- Never generate for weak, expired, broken, geographically ineligible, or unreadable roles.
- Resume generation does not authorize submitting an application.
