import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Result of scanning the working directory for known agent environments. */
export interface DetectedEnvironment {
  /** CLAUDE.md exists in cwd */
  hasClaudeMd: boolean;
  /** .cursor/ directory exists in cwd */
  hasCursor: boolean;
  /** .openhands/ directory exists in cwd */
  hasOpenHands: boolean;
  /** .mcp.json exists in cwd */
  hasMcpJson: boolean;
  /** .gitignore exists in cwd */
  hasGitignore: boolean;
  /** .env.local is listed in .gitignore */
  envLocalIgnored: boolean;
}

/**
 * Detect agent environments by checking for known files/directories in cwd.
 *
 * @param cwd - Working directory to scan (defaults to process.cwd())
 * @returns Detection results for each supported environment
 */
export function detectEnvironment(cwd: string = process.cwd()): DetectedEnvironment {
  const hasGitignore = existsSync(join(cwd, '.gitignore'));

  let envLocalIgnored = false;
  if (hasGitignore) {
    try {
      const gitignoreContent = readFileSync(join(cwd, '.gitignore'), 'utf-8');
      envLocalIgnored = gitignoreContent.split('\n').some((line) => line.trim() === '.env.local');
    } catch {
      // If we can't read .gitignore, treat as not ignored
    }
  }

  return {
    hasClaudeMd: existsSync(join(cwd, 'CLAUDE.md')),
    hasCursor: existsSync(join(cwd, '.cursor')),
    hasOpenHands: existsSync(join(cwd, '.openhands')),
    hasMcpJson: existsSync(join(cwd, '.mcp.json')),
    hasGitignore,
    envLocalIgnored,
  };
}
