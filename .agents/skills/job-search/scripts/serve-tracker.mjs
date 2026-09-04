#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.JOB_HUNT_ROOT || path.join(scriptDir, '../../../..'));
const trackerDir = path.join(workspace, 'tracker');
const dataDir = path.join(workspace, 'data');
const requestedPort = Number(process.env.TRACKER_PORT || 4173);
const maxBody = 20 * 1024 * 1024;
const allowedTables = new Set([
  'applications.csv',
  'application-qa.csv',
  'resume-builds.csv',
  'search-runs.csv',
  'search-sources.csv'
]);

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupCsv(file) {
  if (!fs.existsSync(file)) return;
  const backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, `${path.basename(file, '.csv')}-${stamp()}.csv`));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBody) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function handleApi(request, response, requestPath) {
  if (requestPath === '/api/meta') {
    const tables = [...allowedTables].map(name => {
      let rows = 0;
      try {
        const text = fs.readFileSync(path.join(dataDir, name), 'utf8');
        rows = Math.max(0, text.split(/\r?\n/).filter(line => line.trim()).length - 1);
      } catch { /* missing table */ }
      return { name, rows };
    });
    send(response, 200, JSON.stringify({ workspace, dataDir, tables }), 'application/json; charset=utf-8');
    return;
  }

  if (!requestPath.startsWith('/api/data/')) {
    send(response, 404, 'Not found');
    return;
  }

  const name = path.basename(requestPath);
  if (!allowedTables.has(name) || name !== requestPath.slice('/api/data/'.length)) {
    send(response, 404, 'Unknown table');
    return;
  }

  const file = path.join(dataDir, name);
  if (request.method === 'GET') {
    fs.readFile(file, 'utf8', (error, text) => {
      if (error) { send(response, error.code === 'ENOENT' ? 404 : 500, error.message); return; }
      send(response, 200, text, 'text/csv; charset=utf-8');
    });
    return;
  }

  if (request.method === 'PUT') {
    readBody(request).then(text => {
      fs.mkdirSync(dataDir, { recursive: true });
      backupCsv(file);
      const temporary = `${file}.tmp-${process.pid}`;
      fs.writeFileSync(temporary, text);
      fs.renameSync(temporary, file);
      send(response, 200, 'Saved');
    }).catch(error => {
      send(response, error.status || 500, error.message);
    });
    return;
  }

  send(response, 405, 'Method not allowed');
}

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (requestPath.startsWith('/api/')) {
    handleApi(request, response, requestPath);
    return;
  }

  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(trackerDir, relative);
  if (!file.startsWith(`${trackerDir}${path.sep}`) && file !== path.join(trackerDir, 'index.html')) {
    send(response, 403, 'Forbidden');
    return;
  }
  fs.readFile(file, (error, contents) => {
    if (error) { send(response, error.code === 'ENOENT' ? 404 : 500, 'Not found'); return; }
    send(response, 200, contents, mime[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(requestedPort, '127.0.0.1', () => {
  console.log(`Jobscout: http://127.0.0.1:${requestedPort}`);
  console.log(`Serving workspace data from: ${dataDir}`);
});
