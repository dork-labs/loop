import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface LoopConfig {
  url?: string
  token?: string
}

export interface GlobalOptions {
  json?: boolean
  apiUrl?: string
  token?: string
}

const CONFIG_DIR = path.join(os.homedir(), '.loop')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

/** Read config from ~/.loop/config.json, returning {} if missing. */
export function readConfig(): LoopConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

/** Write config to ~/.loop/config.json with mode 0o600. */
export function writeConfig(config: LoopConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
}

/**
 * Resolve config with priority: CLI flags > env vars > config file.
 */
export function resolveConfig(globalOpts?: GlobalOptions): { url?: string; token?: string } {
  const file = readConfig()
  return {
    url: globalOpts?.apiUrl ?? process.env.LOOP_API_URL ?? file.url,
    token: globalOpts?.token ?? process.env.LOOP_API_TOKEN ?? file.token,
  }
}

/** Mask a token string showing first 4 + last 4 chars. */
export function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}****${token.slice(-4)}`
}
