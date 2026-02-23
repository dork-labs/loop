import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_DIR = join(__dirname, '..');

function readArtifact(relativePath: string): string {
  return readFileSync(join(PKG_DIR, relativePath), 'utf-8');
}

function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function extractFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: match[1], body: match[2] };
}

describe('Token Budget Validation', () => {
  it('SKILL.md description is under 1024 characters', () => {
    const content = readArtifact('SKILL.md');
    const { frontmatter } = extractFrontmatter(content);
    // Extract description field from YAML frontmatter
    const descMatch = frontmatter.match(/description:\s*>\s*\n([\s\S]*?)(?=\n\w|\n---)/);
    const description = descMatch ? descMatch[1].replace(/\n\s*/g, ' ').trim() : '';
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it('SKILL.md body is under 5000 tokens', () => {
    const content = readArtifact('SKILL.md');
    const { body } = extractFrontmatter(content);
    const tokens = estimateTokens(body);
    expect(tokens).toBeLessThan(5000);
  });

  it('AGENTS.md snippet is under 600 tokens', () => {
    const content = readArtifact('templates/AGENTS.md');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(600);
  });

  it('loop.mdc is under 1000 tokens', () => {
    const content = readArtifact('templates/loop.mdc');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(1000);
  });

  it('openhands-loop.md is under 1500 tokens', () => {
    const content = readArtifact('templates/openhands-loop.md');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(1500);
  });
});

describe('Content Consistency', () => {
  const artifacts = [
    { name: 'SKILL.md', path: 'SKILL.md' },
    { name: 'AGENTS.md', path: 'templates/AGENTS.md' },
    { name: 'loop.mdc', path: 'templates/loop.mdc' },
    { name: 'openhands-loop.md', path: 'templates/openhands-loop.md' },
  ];

  it('all artifacts use consistent API base URL', () => {
    for (const artifact of artifacts) {
      const content = readArtifact(artifact.path);
      expect(content, `${artifact.name} missing API base URL`).toContain(
        'https://app.looped.me/api'
      );
    }
  });

  it('all artifacts reference LOOP_API_KEY', () => {
    for (const artifact of artifacts) {
      const content = readArtifact(artifact.path);
      expect(content, `${artifact.name} missing LOOP_API_KEY`).toContain('LOOP_API_KEY');
    }
  });

  it('all artifacts use Bearer auth pattern', () => {
    for (const artifact of artifacts) {
      const content = readArtifact(artifact.path);
      expect(content, `${artifact.name} missing Bearer auth`).toContain('Authorization: Bearer');
    }
  });
});
