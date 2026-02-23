import { describe, it, expect } from 'vitest';
import { buildCursorDeeplink, buildCursorWebDeeplink } from '@/lib/deeplink-builders';

describe('buildCursorDeeplink', () => {
  it('generates valid cursor:// URL with base64 config', () => {
    const result = buildCursorDeeplink('http://localhost:5667', 'loop_test123');
    expect(result).toMatch(/^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=loop&config=/);
  });

  it('embeds correct API URL and key in config', () => {
    const result = buildCursorDeeplink('http://localhost:5667', 'loop_test123');
    const configParam = new URL(result.replace('cursor://', 'https://')).searchParams.get('config')!;
    const config = JSON.parse(atob(configParam));
    expect(config).toEqual({
      command: 'npx',
      args: ['-y', '@dork-labs/loop-mcp', '--api-url', 'http://localhost:5667', '--api-key', 'loop_test123'],
    });
  });

  it('handles special characters in API URL', () => {
    const result = buildCursorDeeplink('https://api.example.com/v1?foo=bar&baz=1', 'loop_key');
    expect(result).toContain('cursor://');
    const configParam = new URL(result.replace('cursor://', 'https://')).searchParams.get('config')!;
    const config = JSON.parse(atob(configParam));
    expect(config.args).toContain('https://api.example.com/v1?foo=bar&baz=1');
  });
});

describe('buildCursorWebDeeplink', () => {
  it('generates valid https://cursor.com/link/ URL', () => {
    const result = buildCursorWebDeeplink('http://localhost:5667', 'loop_test123');
    expect(result).toMatch(/^https:\/\/cursor\.com\/link\/mcp\/install\?name=loop&config=/);
  });

  it('uses encodeURIComponent(btoa()) encoding', () => {
    const result = buildCursorWebDeeplink('http://localhost:5667', 'loop_test123');
    const url = new URL(result);
    const encodedConfig = url.searchParams.get('config')!;
    const config = JSON.parse(atob(decodeURIComponent(encodedConfig)));
    expect(config.command).toBe('npx');
    expect(config.args).toContain('@dork-labs/loop-mcp');
  });
});
