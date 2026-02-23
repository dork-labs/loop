import { describe, it, expect } from 'vitest';
import { GET } from '../route';

describe('GET /llms.txt', () => {
  it('returns markdown with correct content-type', async () => {
    const response = await GET();
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });

  it('returns correct cache-control headers', async () => {
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
  });

  it('body starts with # Loop', async () => {
    const response = await GET();
    const body = await response.text();
    expect(body.startsWith('# Loop')).toBe(true);
  });

  it('contains all required H2 sections', async () => {
    const response = await GET();
    const body = await response.text();
    const requiredSections = [
      '## Getting Started',
      '## Issues',
      '## Signals',
      '## Agent Dispatch',
      '## Projects and Goals',
      '## Prompt Templates',
      '## Agent Integration',
      '## Optional',
    ];
    for (const section of requiredSections) {
      expect(body).toContain(section);
    }
  });
});
