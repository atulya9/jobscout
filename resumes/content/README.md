# Resume evidence bank

`resume-content.json` is the factual source used by resume generation. It stores contact information, source-document provenance, approved summaries, experience bullets with stable IDs, skills, projects, education, and certifications.

See `../../docs/resume-data-model.md` for the expected evidence-bank and profile structure.

When a source resume changes, ask the agent to compare the complete source against this file. New or materially stronger claims require user approval. Keep previous bullet IDs stable so existing job-specific manifests remain reproducible.

For a fresh installation, place the candidate's resume files in `../master/` and ask:

> Build my resume evidence bank and emphasis profiles from the resumes in this workspace.

Do not copy another candidate's `resume-content.json`.
