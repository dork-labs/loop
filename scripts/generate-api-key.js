#!/usr/bin/env node
/* global console, process */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_ENV = path.join(__dirname, '..', 'apps', 'api', '.env');
const APP_ENV = path.join(__dirname, '..', 'apps', 'app', '.env');

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1] : null;
}

function setEnvValue(filePath, key, value) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${key}=${value}\n`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    fs.writeFileSync(filePath, content.replace(regex, `${key}=${value}`));
  } else {
    fs.appendFileSync(filePath, `\n${key}=${value}\n`);
  }
}

// Support --force flag to regenerate
const force = process.argv.includes('--force');

// Check if valid loop_ key already exists in both files
const apiKey = readEnvValue(API_ENV, 'LOOP_API_KEY');
const appKey = readEnvValue(APP_ENV, 'VITE_LOOP_API_KEY');

if (!force && apiKey?.startsWith('loop_') && appKey?.startsWith('loop_') && apiKey === appKey) {
  console.log(`API key already exists: ${apiKey.slice(0, 10)}...`);
  console.log('Skipping generation. Use --force to regenerate.');
  process.exit(0);
}

if (!force && apiKey?.startsWith('loop_')) {
  console.log(`API key already exists: ${apiKey.slice(0, 10)}...`);
  console.log('Skipping generation. Use --force to regenerate.');
  process.exit(0);
}

// Generate new key
const secret = crypto.randomBytes(32).toString('hex');
const key = `loop_${secret}`;

setEnvValue(API_ENV, 'LOOP_API_KEY', key);
setEnvValue(APP_ENV, 'VITE_LOOP_API_KEY', key);

console.log(`Generated API key: ${key.slice(0, 10)}...`);
console.log(`Written to:`);
console.log(`  ${API_ENV}`);
console.log(`  ${APP_ENV}`);
