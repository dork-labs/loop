/**
 * Loop Connect — interactive setup flow for connecting a project to Loop.
 *
 * @module @dork-labs/loop-connect
 */

import * as p from '@clack/prompts';
import { AuthError, NetworkError, listProjects, createProject } from './lib/api.js';
import type { LoopProject } from './lib/api.js';
import { detectEnvironment } from './lib/detectors.js';
import {
  writeEnvLocal,
  writeMcpJson,
  writeClaudeMdBlock,
  writeCursorRules,
  writeOpenHandsMicroagent,
} from './lib/writers.js';
import type { WriteResult } from './lib/writers.js';

export interface RunOptions {
  nonInteractive: boolean;
  apiKey?: string;
  apiUrl: string;
}

const CREATE_NEW_PROJECT = '__create_new__';

/** Mask an API key for display: loop_***...{last 4 chars} */
function maskKey(key: string): string {
  if (key.length <= 8) return 'loop_***';
  return `loop_***...${key.slice(-4)}`;
}

/** Sync validation for the API key password prompt. */
function validateKeyFormat(value: string | undefined): string | undefined {
  if (!value) return 'API key is required';
  if (!value.startsWith('loop_')) return 'Key must start with loop_';
  if (value.length < 37) return 'Key is too short';
  return undefined;
}

/** Format a WriteResult for the summary note. */
function formatResult(result: WriteResult, label: string): string {
  switch (result.status) {
    case 'written':
      return `  \u2713 ${result.path}  \u2014 ${label}`;
    case 'skipped':
      return `  \u25CB ${result.path}  \u2014 ${result.reason ?? 'Skipped'}`;
    case 'conflict':
      return `  \u26A0 ${result.path}  \u2014 ${result.reason ?? 'Conflict'}`;
  }
}

/** Format a skipped file that was not detected. */
function formatSkipped(name: string): string {
  return `  \u25CB ${name}  \u2014 Skipped (not detected)`;
}

/**
 * Validate an API key against the Loop API by fetching projects.
 *
 * @returns Projects on success, or a tagged error object on failure
 */
async function validateApiKey(
  apiUrl: string,
  apiKey: string
): Promise<{ ok: true; projects: LoopProject[] } | { ok: false; error: 'auth' | 'network' }> {
  try {
    const response = await listProjects(apiUrl, apiKey);
    return { ok: true, projects: response.data };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'auth' };
    if (err instanceof NetworkError) return { ok: false, error: 'network' };
    throw err;
  }
}

/** Prompt for API key with re-prompt on auth errors. */
async function promptForApiKey(
  apiUrl: string
): Promise<{ apiKey: string; projects: LoopProject[] }> {
  while (true) {
    const keyResult = await p.password({
      message: 'Enter your Loop API key',
      validate: validateKeyFormat,
    });

    if (p.isCancel(keyResult)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const apiKey = keyResult as string;
    const s = p.spinner();
    s.start(`Validating key ${maskKey(apiKey)}`);

    const validation = await validateApiKey(apiUrl, apiKey);

    if (validation.ok) {
      s.stop(`Key validated \u2014 ${validation.projects.length} project(s) found`);
      return { apiKey, projects: validation.projects };
    }

    if (validation.error === 'auth') {
      s.stop('Invalid API key');
      p.log.error('Authentication failed. Check your key and try again.');
      continue;
    }

    // Network error
    s.stop('Could not reach Loop API');
    p.log.warn('Network error \u2014 could not reach Loop API at ' + apiUrl);

    const continueResult = await p.confirm({
      message: 'Continue without validating the API key?',
      initialValue: false,
    });

    if (p.isCancel(continueResult)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    if (continueResult) {
      return { apiKey, projects: [] };
    }
    // If they decline, loop back to key prompt
  }
}

/** Prompt the user to select or create a project. */
async function promptForProject(
  apiUrl: string,
  apiKey: string,
  projects: LoopProject[]
): Promise<LoopProject> {
  const options = [
    ...projects.map((proj) => ({
      value: proj.id,
      label: proj.name,
      hint: proj.status,
    })),
    { value: CREATE_NEW_PROJECT, label: 'Create new project' },
  ];

  const selection = await p.select({
    message: 'Select a project',
    options,
  });

  if (p.isCancel(selection)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  if (selection === CREATE_NEW_PROJECT) {
    const nameResult = await p.text({
      message: 'Project name',
      placeholder: 'my-project',
      validate: (value) => {
        if (!value?.trim()) return 'Name is required';
        return undefined;
      },
    });

    if (p.isCancel(nameResult)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const s = p.spinner();
    s.start('Creating project');
    const project = await createProject(apiUrl, apiKey, nameResult as string);
    s.stop(`Created project: ${project.name}`);
    return project;
  }

  const selected = projects.find((proj) => proj.id === selection);
  if (!selected) {
    // Shouldn't happen, but handle gracefully
    throw new Error('Selected project not found');
  }
  return selected;
}

/** Write all applicable files based on environment detection. */
function writeFiles(
  apiKey: string,
  apiUrl: string,
  env: ReturnType<typeof detectEnvironment>
): { results: WriteResult[]; labels: string[]; skipped: string[] } {
  const results: WriteResult[] = [];
  const labels: string[] = [];
  const skipped: string[] = [];

  // Always write .env.local
  results.push(writeEnvLocal(apiKey, apiUrl));
  labels.push('LOOP_API_KEY, LOOP_API_URL');

  // Write .mcp.json if MCP or Claude Code detected
  if (env.hasMcpJson || env.hasClaudeMd) {
    results.push(writeMcpJson(apiKey, apiUrl));
    labels.push('MCP server config');
  } else {
    skipped.push('.mcp.json');
  }

  // Write CLAUDE.md block if file exists
  if (env.hasClaudeMd) {
    results.push(writeClaudeMdBlock());
    labels.push('Loop context block (appended)');
  } else {
    skipped.push('CLAUDE.md');
  }

  // Write Cursor rules if .cursor/ exists
  if (env.hasCursor) {
    results.push(writeCursorRules());
    labels.push('Cursor rules');
  } else {
    skipped.push('.cursor/rules/');
  }

  // Write OpenHands microagent if .openhands/ exists
  if (env.hasOpenHands) {
    results.push(writeOpenHandsMicroagent());
    labels.push('OpenHands microagent');
  } else {
    skipped.push('.openhands/');
  }

  return { results, labels, skipped };
}

/** Build the summary note content. */
function buildSummary(
  results: WriteResult[],
  labels: string[],
  skipped: string[],
  envLocalIgnored: boolean,
  projectName: string
): string {
  const lines: string[] = [];

  for (let i = 0; i < results.length; i++) {
    lines.push(formatResult(results[i], labels[i]));
  }

  for (const name of skipped) {
    lines.push(formatSkipped(name));
  }

  if (!envLocalIgnored) {
    lines.push('');
    lines.push('  \u26A0 Add .env.local to .gitignore');
  }

  lines.push('');
  lines.push(`Connected to project: ${projectName}`);

  return lines.join('\n');
}

/** Run the interactive setup flow. */
async function runInteractive(options: RunOptions): Promise<void> {
  p.intro('Loop \u2014 Connect your project');

  // Step 1: API key (use provided or prompt)
  let apiKey: string;
  let projects: LoopProject[];

  if (options.apiKey) {
    apiKey = options.apiKey;
    const s = p.spinner();
    s.start(`Validating key ${maskKey(apiKey)}`);
    const validation = await validateApiKey(options.apiUrl, apiKey);

    if (validation.ok) {
      s.stop(`Key validated \u2014 ${validation.projects.length} project(s) found`);
      projects = validation.projects;
    } else if (validation.error === 'auth') {
      s.stop('Invalid API key');
      p.log.error('The provided --api-key is invalid.');
      const prompted = await promptForApiKey(options.apiUrl);
      apiKey = prompted.apiKey;
      projects = prompted.projects;
    } else {
      s.stop('Could not reach Loop API');
      p.log.warn('Network error \u2014 could not reach Loop API');
      const continueResult = await p.confirm({
        message: 'Continue without validating the API key?',
        initialValue: false,
      });
      if (p.isCancel(continueResult)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }
      if (!continueResult) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }
      projects = [];
    }
  } else {
    const prompted = await promptForApiKey(options.apiUrl);
    apiKey = prompted.apiKey;
    projects = prompted.projects;
  }

  // Step 2: Project selection
  let project: LoopProject | undefined;
  if (projects.length > 0) {
    project = await promptForProject(options.apiUrl, apiKey, projects);
  } else {
    // No projects available (network error or empty list)
    const nameResult = await p.text({
      message: 'Project name (will be created when API is reachable)',
      placeholder: 'my-project',
      validate: (value) => {
        if (!value?.trim()) return 'Name is required';
        return undefined;
      },
    });

    if (p.isCancel(nameResult)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    // Try to create the project
    try {
      const s = p.spinner();
      s.start('Creating project');
      project = await createProject(options.apiUrl, apiKey, nameResult as string);
      s.stop(`Created project: ${project.name}`);
    } catch {
      p.log.warn('Could not create project \u2014 files will be written anyway.');
    }
  }

  // Step 3: Detect environment
  const env = detectEnvironment();

  // Step 4: Write files
  const { results, labels, skipped } = writeFiles(apiKey, options.apiUrl, env);

  // Step 5: Summary
  const projectName = project?.name ?? 'Unknown';
  const summary = buildSummary(results, labels, skipped, env.envLocalIgnored, projectName);
  p.note(summary, 'Files written');

  // Step 6: Outro
  const outroUrl = project
    ? `Connected! Visit https://app.looped.me/projects/${project.id}`
    : 'Connected! Visit https://app.looped.me';
  p.outro(outroUrl);
}

/** Run the non-interactive setup flow (--yes mode). */
async function runNonInteractive(options: RunOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.LOOP_API_KEY;
  if (!apiKey) {
    console.error('Error: No API key provided. Use --api-key or set LOOP_API_KEY.');
    process.exit(1);
  }

  let projects: LoopProject[];
  try {
    const response = await listProjects(options.apiUrl, apiKey);
    projects = response.data;
  } catch (err) {
    if (err instanceof AuthError) {
      console.error('Error: Invalid API key.');
    } else {
      console.error('Error: Could not reach Loop API.');
    }
    process.exit(1);
  }

  if (projects.length === 0) {
    console.error('Error: No projects found. Create one at https://app.looped.me');
    process.exit(1);
  }

  const project = projects[0];
  console.log(`Using project: ${project.name}`);

  const env = detectEnvironment();
  const results: WriteResult[] = [];

  results.push(writeEnvLocal(apiKey, options.apiUrl));
  if (env.hasMcpJson || env.hasClaudeMd) {
    results.push(writeMcpJson(apiKey, options.apiUrl));
  }
  if (env.hasClaudeMd) results.push(writeClaudeMdBlock());
  if (env.hasCursor) results.push(writeCursorRules());
  if (env.hasOpenHands) results.push(writeOpenHandsMicroagent());

  for (const r of results) {
    const icon = r.status === 'written' ? '\u2713' : '\u25CB';
    console.log(`  ${icon} ${r.path}${r.reason ? ` \u2014 ${r.reason}` : ''}`);
  }

  if (!env.envLocalIgnored) {
    console.log('\n  \u26A0 Add .env.local to .gitignore');
  }

  console.log(`\nConnected to project: ${project.name}`);
}

/**
 * Main entry point for the Loop Connect CLI.
 *
 * @param options - CLI options from argument parsing
 */
export async function run(options: RunOptions): Promise<void> {
  if (options.nonInteractive) {
    await runNonInteractive(options);
  } else {
    await runInteractive(options);
  }
}
