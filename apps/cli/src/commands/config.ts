import { Command } from 'commander'
import { readConfig, writeConfig, maskToken } from '../lib/config.js'

/** Register the `config` command with set/get/list subcommands. */
export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Manage CLI configuration')

  config
    .command('set <key> <value>')
    .description('Set a config value (url or token)')
    .action((key: string, value: string) => {
      const cfg = readConfig()
      if (key === 'url') {
        cfg.url = value
        writeConfig(cfg)
        console.log(`URL set: ${value}`)
      } else if (key === 'token') {
        cfg.token = value
        writeConfig(cfg)
        console.log(`Token set: ${maskToken(value)}`)
      } else {
        console.error(`Unknown config key: ${key}. Valid keys: url, token`)
        process.exit(1)
      }
    })

  config
    .command('get <key>')
    .description('Get a config value')
    .action((key: string) => {
      const cfg = readConfig()
      if (key === 'url') {
        console.log(cfg.url ?? '(not set)')
      } else if (key === 'token') {
        console.log(cfg.token ? maskToken(cfg.token) : '(not set)')
      } else {
        console.error(`Unknown config key: ${key}. Valid keys: url, token`)
        process.exit(1)
      }
    })

  config
    .command('list')
    .description('List all config values')
    .action(() => {
      const cfg = readConfig()
      console.log(`url:   ${cfg.url ?? '(not set)'}`)
      console.log(`token: ${cfg.token ? maskToken(cfg.token) : '(not set)'}`)
    })
}
