#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.JOB_HUNT_ROOT || path.join(scriptDir, '../../../..'));
const trackerDir = path.join(workspace, 'tracker');
const requestedPort = Number(process.env.TRACKER_PORT || 4173);

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(trackerDir, relative);
  if (!file.startsWith(`${trackerDir}${path.sep}`) && file !== path.join(trackerDir, 'index.html')) {
    response.writeHead(403).end('Forbidden'); return;
  }
  fs.readFile(file, (error, contents) => {
    if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(contents);
  });
});

server.listen(requestedPort, '127.0.0.1', () => {
  console.log(`Job tracker: http://127.0.0.1:${requestedPort}`);
  console.log(`Click “Open data folder” and choose: ${path.join(workspace, 'data')}`);
});
