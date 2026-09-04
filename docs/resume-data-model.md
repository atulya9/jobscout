# Resume data model

The resume generator reads two candidate-specific JSON layers. Both are local and ignored by Git.

## Evidence bank

`resumes/content/resume-content.json` contains:

- `schema_version`: currently `1`.
- `candidate`: name, email, phone, location, LinkedIn URL, and experience years.
- `source_documents`: stable source IDs, titles, purposes, URLs or local paths, and modification timestamps.
- `provenance_policy`: which transformations are safe and which changes require user approval.
- `summaries`: named summary objects containing text and supporting source IDs.
- `experience`: ordered jobs with stable job IDs, company, title, dates, technologies, and bullets.
- `education`, `skills`, `skill_labels`, `projects`, and `certifications`.

Every experience bullet requires:

```json
{
  "id": "stable-company-topic-id",
  "text": "An approved, resume-sourced accomplishment.",
  "tags": ["backend", "reliability"],
  "keywords": ["fault tolerance", "observability"],
  "source_ids": ["source-resume-id"]
}
```

Optional bullet fields are:

- `variants`: approved wording keyed by profile variant, such as `ai-forward`.
- `url` and `link_label`: a verified hyperlink and the exact linked text inside the bullet.

IDs must remain stable after generation because manifests and previous applications reference them. Never remove or repurpose an ID merely to improve wording; add an approved variant or a new ID when meaning changes materially.

## Emphasis profiles

Each file under `resumes/profiles/` contains:

```json
{
  "profile_id": "backend-first",
  "display_name": "Backend-first with AI credibility",
  "best_for": ["Senior Backend Engineer"],
  "summary_id": "backend-first",
  "bullet_variant": "default",
  "section_order": ["experience", "skills", "projects", "education", "certifications"],
  "skills_order": ["languages", "backend-data", "cloud-infrastructure"],
  "project_order": ["project-id"],
  "experience": {
    "job-id": ["approved-bullet-id-1", "approved-bullet-id-2"]
  }
}
```

Create backend-first, balanced, and AI-forward profiles from the candidate's evidence. A profile selects and orders evidence; it does not introduce new facts.

## Job-specific selections

A selection JSON uses `profile_id` and can override summary, section ordering, skill ordering, project ordering, and experience bullet arrays. It also records job metadata and a `tailoring` audit object. See `.agents/skills/job-search/references/resume-tailoring.md` for the complete workflow.
