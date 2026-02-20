import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock the config module before importing the command
vi.mock('../../src/lib/config.js', () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  maskToken: vi.fn(),
}))

import { readConfig, writeConfig, maskToken } from '../../src/lib/config.js'
import { registerConfigCommand } from '../../src/commands/config.js'

describe('config command', () => {
  let program: Command
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let _exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    program = new Command()
    program.exitOverride() // throw instead of process.exit
    registerConfigCommand(program)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    _exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    vi.mocked(readConfig).mockReturnValue({})
    vi.mocked(writeConfig).mockImplementation(() => {})
    vi.mocked(maskToken).mockImplementation((t: string) => `masked(${t})`)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('config set', () => {
    it('sets url in config file', async () => {
      vi.mocked(readConfig).mockReturnValue({ token: 'existing_token' })

      await program.parseAsync(['node', 'looped', 'config', 'set', 'url', 'https://api.looped.me'])

      expect(writeConfig).toHaveBeenCalledWith({
        token: 'existing_token',
        url: 'https://api.looped.me',
      })
      expect(consoleSpy).toHaveBeenCalledWith('URL set: https://api.looped.me')
    })

    it('sets token in config file and prints masked value', async () => {
      vi.mocked(readConfig).mockReturnValue({ url: 'https://api.looped.me' })

      await program.parseAsync(['node', 'looped', 'config', 'set', 'token', 'tok_secret123'])

      expect(writeConfig).toHaveBeenCalledWith({
        url: 'https://api.looped.me',
        token: 'tok_secret123',
      })
      expect(consoleSpy).toHaveBeenCalledWith('Token set: masked(tok_secret123)')
    })

    it('exits with error for unknown config key', async () => {
      await expect(
        program.parseAsync(['node', 'looped', 'config', 'set', 'badkey', 'value'])
      ).rejects.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unknown config key: badkey. Valid keys: url, token'
      )
      expect(writeConfig).not.toHaveBeenCalled()
    })
  })

  describe('config get', () => {
    it('prints url value when set', async () => {
      vi.mocked(readConfig).mockReturnValue({ url: 'https://api.looped.me' })

      await program.parseAsync(['node', 'looped', 'config', 'get', 'url'])

      expect(consoleSpy).toHaveBeenCalledWith('https://api.looped.me')
    })

    it('prints (not set) when url is not configured', async () => {
      vi.mocked(readConfig).mockReturnValue({})

      await program.parseAsync(['node', 'looped', 'config', 'get', 'url'])

      expect(consoleSpy).toHaveBeenCalledWith('(not set)')
    })

    it('prints masked token when set', async () => {
      vi.mocked(readConfig).mockReturnValue({ token: 'tok_secret123' })

      await program.parseAsync(['node', 'looped', 'config', 'get', 'token'])

      expect(consoleSpy).toHaveBeenCalledWith('masked(tok_secret123)')
    })

    it('prints (not set) when token is not configured', async () => {
      vi.mocked(readConfig).mockReturnValue({})

      await program.parseAsync(['node', 'looped', 'config', 'get', 'token'])

      expect(consoleSpy).toHaveBeenCalledWith('(not set)')
    })

    it('exits with error for unknown config key', async () => {
      await expect(
        program.parseAsync(['node', 'looped', 'config', 'get', 'badkey'])
      ).rejects.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unknown config key: badkey. Valid keys: url, token'
      )
    })
  })

  describe('config list', () => {
    it('prints all values with token masked', async () => {
      vi.mocked(readConfig).mockReturnValue({
        url: 'https://api.looped.me',
        token: 'tok_secret123',
      })

      await program.parseAsync(['node', 'looped', 'config', 'list'])

      expect(consoleSpy).toHaveBeenCalledWith('url:   https://api.looped.me')
      expect(consoleSpy).toHaveBeenCalledWith('token: masked(tok_secret123)')
    })

    it('prints (not set) for missing values', async () => {
      vi.mocked(readConfig).mockReturnValue({})

      await program.parseAsync(['node', 'looped', 'config', 'list'])

      expect(consoleSpy).toHaveBeenCalledWith('url:   (not set)')
      expect(consoleSpy).toHaveBeenCalledWith('token: (not set)')
    })

    it('prints (not set) for token when only url is configured', async () => {
      vi.mocked(readConfig).mockReturnValue({ url: 'https://api.looped.me' })

      await program.parseAsync(['node', 'looped', 'config', 'list'])

      expect(consoleSpy).toHaveBeenCalledWith('url:   https://api.looped.me')
      expect(consoleSpy).toHaveBeenCalledWith('token: (not set)')
    })
  })
})
