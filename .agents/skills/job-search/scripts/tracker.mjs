#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.JOB_HUNT_ROOT || path.join(scriptDir, '../../../..'));
const dataDir = path.join(workspace, 'data');
const templateDataDir = path.join(workspace, 'templates', 'data');

const schemas = {
  applications: ['job_id','company','role','role_type','track','location','work_arrangement','compensation','url','canonical_url','ats_job_id','source','first_seen','last_verified','application_date','updated_at','status','jd_verified','verification','score','fit_summary','gaps','user_notes','failure_reason','checks_attempted'],
  'application-qa': ['qa_id','job_id','company','role','url','question','answer','evidence','answer_status','created_at','updated_at'],
  'resume-builds': ['resume_id','job_id','company','role','profile_id','source_jd_url','generated_at','html_path','pdf_path','tailoring_level','match_score','change_summary','unsupported_requirements','review_status','notes'],
  'search-runs': ['run_id','started_at','completed_at','query_date','status','portals_checked','roles_found','roles_added','jd_needed_added','duplicates_skipped','blocked_sources','notes'],
  'search-sources': ['source','base_url','category','default_method','fallback_method','requires_login','enabled','last_checked','status','notes']
};

const aliases = Object.fromEntries(Object.keys(schemas).flatMap(name => [[name, name], [`${name}.csv`, name]]));

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((value, index) => index === 0 || value.some(cell => cell !== ''));
}

function quote(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows.map(row => headers.map(header => row[header] ?? ''))]
    .map(row => row.map(quote).join(','))
    .join('\n') + '\n';
}

function tablePath(name) {
  const resolved = aliases[name];
  if (!resolved) throw new Error(`Unknown table: ${name}`);
  return { name: resolved, file: path.join(dataDir, `${resolved}.csv`) };
}

function readTable(name) {
  const target = tablePath(name);
  const matrix = parseCsv(fs.readFileSync(target.file, 'utf8'));
  const headers = matrix[0] || schemas[target.name];
  const rows = matrix.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  return { ...target, headers, rows };
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  const backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, `${path.basename(file, '.csv')}-${stamp()}.csv`));
}

function writeTable(table) {
  backup(table.file);
  const temporary = `${table.file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, toCsv(table.headers, table.rows), 'utf8');
  fs.renameSync(temporary, table.file);
}

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/\/$/, '').replace(/\s+/g, ' ');
}

function sameRecord(table, left, right) {
  const hasEqual = field => normalized(left[field]) && normalized(left[field]) === normalized(right[field]);
  if (table === 'applications') {
    return hasEqual('job_id') || hasEqual('canonical_url') || hasEqual('ats_job_id') || hasEqual('url') ||
      (hasEqual('company') && hasEqual('role') && hasEqual('location'));
  }
  if (table === 'application-qa') return hasEqual('qa_id') || (hasEqual('job_id') && hasEqual('question'));
  if (table === 'resume-builds') return hasEqual('resume_id') || (hasEqual('job_id') && hasEqual('profile_id'));
  if (table === 'search-runs') return hasEqual('run_id');
  return hasEqual('source');
}

function init() {
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'application-answers'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'resumes', 'generated'), { recursive: true });
  for (const [name, headers] of Object.entries(schemas)) {
    const file = path.join(dataDir, `${name}.csv`);
    const template = path.join(templateDataDir, `${name}.csv`);
    if (!fs.existsSync(file)) {
      if (fs.existsSync(template)) fs.copyFileSync(template, file);
      else fs.writeFileSync(file, toCsv(headers, []), 'utf8');
    }
  }
  const preferences = path.join(workspace, 'config', 'preferences.json');
  const preferencesExample = path.join(workspace, 'config', 'preferences.example.json');
  if (!fs.existsSync(preferences) && fs.existsSync(preferencesExample)) fs.copyFileSync(preferencesExample, preferences);
  console.log(`Tracker initialized at ${workspace}`);
}

function validate() {
  let failed = false;
  for (const [name, required] of Object.entries(schemas)) {
    const table = readTable(name);
    const missing = required.filter(header => !table.headers.includes(header));
    if (missing.length) { console.error(`${name}: missing columns ${missing.join(', ')}`); failed = true; }
    console.log(`${name}: ${table.rows.length} row(s)`);
  }
  const applications = readTable('applications').rows;
  const duplicatePairs = [];
  for (let i = 0; i < applications.length; i++) {
    for (let j = i + 1; j < applications.length; j++) {
      if (sameRecord('applications', applications[i], applications[j])) duplicatePairs.push([applications[i].job_id || i + 2, applications[j].job_id || j + 2]);
    }
  }
  if (duplicatePairs.length) {
    console.error(`applications: possible duplicates ${duplicatePairs.map(pair => pair.join(' ↔ ')).join('; ')}`);
    failed = true;
  }
  if (failed) process.exitCode = 1;
  else console.log('Validation passed.');
}

function upsert(name, inputFile, allowUserFields, allowEmptyFields) {
  const table = readTable(name);
  const incomingValue = JSON.parse(fs.readFileSync(path.resolve(inputFile), 'utf8'));
  const incoming = Array.isArray(incomingValue) ? incomingValue : [incomingValue];
  const protectedFields = new Set(name === 'applications' ? ['application_date', 'status', 'user_notes'] : []);
  for (const record of incoming) {
    for (const key of Object.keys(record)) if (!table.headers.includes(key)) table.headers.push(key);
    const existing = table.rows.find(row => sameRecord(name, row, record));
    if (!existing) table.rows.push(Object.fromEntries(table.headers.map(header => [header, record[header] ?? ''])));
    else for (const [key, value] of Object.entries(record)) {
      if (protectedFields.has(key) && existing[key] && !allowUserFields) continue;
      if (value !== undefined && value !== null && (allowEmptyFields || value !== '')) existing[key] = String(value);
    }
  }
  writeTable(table);
  console.log(`${name}: upserted ${incoming.length} record(s)`);
}

function list(name) {
  const table = readTable(name);
  console.log(JSON.stringify(table.rows, null, 2));
}

function usage() {
  console.log(`Usage:
  tracker.mjs init
  tracker.mjs validate
  tracker.mjs list <table>
  tracker.mjs upsert <table> <input.json> [--allow-user-fields] [--allow-empty-fields]

Tables: ${Object.keys(schemas).join(', ')}
Set JOB_HUNT_ROOT to override the inferred workspace root.`);
}

const [command = 'help', name, inputFile, ...flags] = process.argv.slice(2);
try {
  if (command === 'init') init();
  else if (command === 'validate') validate();
  else if (command === 'list' && name) list(name);
  else if (command === 'upsert' && name && inputFile) upsert(name, inputFile, flags.includes('--allow-user-fields'), flags.includes('--allow-empty-fields'));
  else usage();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
