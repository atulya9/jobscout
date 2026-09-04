#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.JOB_HUNT_ROOT || path.join(scriptDir, '../../../..'));
const contentFile = path.join(workspace, 'resumes/content/resume-content.json');
const profilesDir = path.join(workspace, 'resumes/profiles');
const templateFile = path.join(workspace, 'resumes/templates/resume.html');
const cssFile = path.join(workspace, 'resumes/templates/resume.css');

function argsToObject(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    if (key === 'pdf' || key === 'list-profiles') result[key] = true;
    else result[key] = values[++index];
  }
  return result;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safeSlug(value) {
  return String(value || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'resume';
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function link(url, label) {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function linkedText(text, url, label) {
  if (!url || !label) return escapeHtml(text);
  const index = text.indexOf(label);
  if (index < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, index))}${link(url, label)}${escapeHtml(text.slice(index + label.length))}`;
}

function findBrowser() {
  const candidates = [];
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);
  if (process.platform === 'darwin') candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  );
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      candidates.push(
        path.join(base, 'Google/Chrome/Application/chrome.exe'),
        path.join(base, 'Microsoft/Edge/Application/msedge.exe')
      );
    }
  }
  candidates.push('google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'msedge');
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate;
    if (!candidate.includes(path.sep)) {
      const check = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { encoding: 'utf8' });
      if (check.status === 0) return check.stdout.trim().split(/\r?\n/)[0];
    }
  }
  return null;
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function stopRenderProcess(child, signal = 'SIGTERM') {
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function renderPdf(browser, htmlPath, pdfPath) {
  const browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-render-'));
  if (fs.existsSync(pdfPath)) fs.rmSync(pdfPath);
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    '--no-pdf-header-footer',
    `--user-data-dir=${browserProfile}`,
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href
  ], { detached: process.platform !== 'win32', stdio: 'ignore' });

  let previousSize = -1;
  let stableChecks = 0;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (fs.existsSync(pdfPath)) {
      const size = fs.statSync(pdfPath).size;
      stableChecks = size > 1000 && size === previousSize ? stableChecks + 1 : 0;
      previousSize = size;
      if (stableChecks >= 2) break;
    }
    await delay(250);
  }

  const completed = fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000;
  stopRenderProcess(child);
  await delay(250);
  stopRenderProcess(child, 'SIGKILL');
  fs.rmSync(browserProfile, { recursive: true, force: true });
  if (!completed) throw new Error('PDF rendering timed out before Chrome produced a complete file.');
}

function normalizeProfile(baseProfile, selection) {
  const merged = structuredClone(baseProfile);
  for (const key of ['summary_id', 'bullet_variant', 'section_order', 'skills_order', 'project_order']) {
    if (selection[key] != null) merged[key] = selection[key];
  }
  if (selection.experience) {
    merged.experience = { ...merged.experience, ...selection.experience };
  }
  return merged;
}

function validate(content, profile) {
  if (!content.summaries[profile.summary_id]) throw new Error(`Unknown summary_id: ${profile.summary_id}`);
  const experienceById = new Map(content.experience.map(job => [job.id, job]));
  for (const [jobId, bulletIds] of Object.entries(profile.experience || {})) {
    const job = experienceById.get(jobId);
    if (!job) throw new Error(`Unknown experience id: ${jobId}`);
    const available = new Set(job.bullets.map(bullet => bullet.id));
    for (const bulletId of bulletIds) if (!available.has(bulletId)) throw new Error(`Unknown bullet ${bulletId} for ${jobId}`);
  }
  for (const skillId of profile.skills_order || []) if (!content.skills[skillId]) throw new Error(`Unknown skill category: ${skillId}`);
  const projects = new Set(content.projects.map(project => project.id));
  for (const projectId of profile.project_order || []) if (!projects.has(projectId)) throw new Error(`Unknown project: ${projectId}`);
}

function renderExperience(content, profile) {
  const blocks = [];
  for (const job of content.experience) {
    const requested = profile.experience?.[job.id];
    if (!requested?.length) continue;
    const byId = new Map(job.bullets.map(bullet => [bullet.id, bullet]));
    const bullets = requested.map(id => byId.get(id));
    const bulletHtml = bullets.map(bullet => {
      const text = bullet.variants?.[profile.bullet_variant] || bullet.text;
      return `<li>${linkedText(text, bullet.url, bullet.link_label)}</li>`;
    }).join('\n');
    blocks.push(`<article class="job" data-job="${escapeHtml(job.id)}">
      <div class="job-head">
        <div class="line"><span class="company">${escapeHtml(job.company)}</span><span class="dates">${escapeHtml(job.start)} - ${escapeHtml(job.end)}</span></div>
        <div class="role">${escapeHtml(job.role)}</div>
        <div class="technologies">${escapeHtml(job.technologies.join(', '))}</div>
      </div>
      <ul>${bulletHtml}</ul>
    </article>`);
  }
  return `<section><h2 class="section-title">Work Experience</h2>${blocks.join('\n')}</section>`;
}

function renderSkills(content, profile) {
  const rows = profile.skills_order.map(id => `<div class="skills-row"><span class="label">${escapeHtml(content.skill_labels[id])}:</span> ${escapeHtml(content.skills[id].join(', '))}</div>`).join('\n');
  return `<section><h2 class="section-title">Skills</h2>${rows}</section>`;
}

function renderProjects(content, profile) {
  const byId = new Map(content.projects.map(project => [project.id, project]));
  const blocks = profile.project_order.map(id => byId.get(id)).filter(Boolean).map(project => `<article class="project">
    <div class="project-head">
      <div class="project-name">${link(project.url, project.name)}</div>
      <div class="technologies">${escapeHtml(project.technologies.join(', '))}</div>
    </div>
    <ul>${project.bullets.map(text => `<li>${escapeHtml(text)}</li>`).join('\n')}</ul>
  </article>`).join('\n');
  return `<section><h2 class="section-title">Projects</h2>${blocks}</section>`;
}

function renderEducation(content) {
  const rows = content.education.map(item => `<div class="education-row">
    <div class="education-head">
      <div class="line"><span class="institution">${escapeHtml(item.institution)}</span><span class="dates">${escapeHtml(item.start)} - ${escapeHtml(item.end)}</span></div>
      <div>${escapeHtml(item.degree)}</div>
    </div>
  </div>`).join('\n');
  return `<section><h2 class="section-title">Education</h2>${rows}</section>`;
}

function renderCertifications(content) {
  const rows = content.certifications.map(item => `<div class="certification"><span class="label">${escapeHtml(item.name)}</span> (${escapeHtml(item.issuer)}) - ${escapeHtml(item.year)}</div>`).join('\n');
  return `<section><h2 class="section-title">Certifications</h2>${rows}</section>`;
}

function renderBody(content, profile, selection) {
  const candidate = content.candidate;
  const summary = selection.summary_text || content.summaries[profile.summary_id].text;
  const linkedInLabel = candidate.linkedin_label || candidate.linkedin_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const sections = {
    experience: renderExperience(content, profile),
    skills: renderSkills(content, profile),
    projects: renderProjects(content, profile),
    education: renderEducation(content),
    certifications: renderCertifications(content)
  };
  const contact = [
    link(`mailto:${candidate.email}`, candidate.email),
    escapeHtml(candidate.phone),
    escapeHtml(candidate.location),
    link(candidate.linkedin_url, linkedInLabel)
  ].map(value => `<span>${value}</span>`).join('');
  return `<header class="resume-header"><h1>${escapeHtml(candidate.name)}</h1><div class="contact">${contact}</div></header>
    <p class="summary">${escapeHtml(summary)}</p>
    ${profile.section_order.map(id => sections[id]).filter(Boolean).join('\n')}`;
}

function usage() {
  console.log(`Usage:
  generate-resume.mjs --profile backend-first [--selection path/to/selection.json] [--job-id JOB_ID] [--output-dir DIR] [--pdf]
  generate-resume.mjs --list-profiles

The selection file can override summary_id, summary_text, section_order, skills_order,
project_order, experience bullet arrays, and job metadata. Use only approved bullet IDs.`);
}

const options = argsToObject(process.argv.slice(2));
if (options['list-profiles']) {
  for (const file of fs.readdirSync(profilesDir).filter(name => name.endsWith('.json')).sort()) {
    const profile = readJson(path.join(profilesDir, file));
    console.log(`${profile.profile_id}\t${profile.display_name}`);
  }
  process.exit(0);
}

if (!options.profile && !options.selection) {
  usage();
  process.exit(1);
}

const content = readJson(contentFile);
const selection = options.selection ? readJson(path.resolve(options.selection)) : {};
const profileId = selection.profile_id || options.profile;
const baseProfile = readJson(path.join(profilesDir, `${profileId}.json`));
const profile = normalizeProfile(baseProfile, selection);
validate(content, profile);

const jobId = options['job-id'] || selection.job?.job_id;
const defaultDir = jobId
  ? path.join(workspace, 'resumes/generated', safeSlug(jobId), stamp())
  : path.join(workspace, 'resumes/generated', 'baselines', safeSlug(profileId));
const outputDir = path.resolve(options['output-dir'] || defaultDir);
fs.mkdirSync(outputDir, { recursive: true });

const template = fs.readFileSync(templateFile, 'utf8');
const styles = fs.readFileSync(cssFile, 'utf8');
const title = `${content.candidate.name} - ${selection.job?.role || baseProfile.display_name}`;
const html = template
  .replace('{{TITLE}}', escapeHtml(title))
  .replace('{{STYLES}}', styles)
  .replace('{{BODY}}', renderBody(content, profile, selection));
const htmlPath = path.join(outputDir, 'resume.html');
fs.writeFileSync(htmlPath, html, 'utf8');

let pdfPath = null;
if (options.pdf) {
  const browser = findBrowser();
  if (!browser) throw new Error('Chrome, Chromium, or Edge was not found. Set CHROME_PATH or omit --pdf.');
  pdfPath = path.join(outputDir, 'resume.pdf');
  await renderPdf(browser, htmlPath, pdfPath);
}

const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  profile_id: profileId,
  job: selection.job || (jobId ? { job_id: jobId } : null),
  summary_id: profile.summary_id,
  custom_summary: Boolean(selection.summary_text),
  experience: profile.experience,
  skills_order: profile.skills_order,
  project_order: profile.project_order,
  section_order: profile.section_order,
  tailoring: selection.tailoring || null,
  source_document_ids: content.source_documents.map(source => source.source_id),
  outputs: { html_path: htmlPath, pdf_path: pdfPath }
};
const manifestPath = path.join(outputDir, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ html_path: htmlPath, pdf_path: pdfPath, manifest_path: manifestPath }, null, 2));
