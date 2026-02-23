import { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import { LoopClient } from '@dork-labs/loop-sdk';
import { readConfig, writeConfig, maskToken } from '../lib/config.js';

/** Register the `auth` command group with login, logout, status. */
export function registerAuthCommand(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Loop API')
    .action(async () => {
      const { input, password } = await import('@inquirer/prompts');
      const config = readConfig();

      // Prompt for API URL
      const url = await input({
        message: 'Loop API URL:',
        default: config.url || 'http://localhost:5667',
      });

      // Prompt for API key
      const token = await password({
        message: 'API key (starts with loop_):',
      });

      // Validate the key works
      const spinner = createSpinner('Validating...').start();
      try {
        const client = new LoopClient({ apiKey: token, baseURL: url });
        await client.dashboard.stats();
        spinner.success({ text: 'Authenticated successfully' });
      } catch {
        spinner.error({ text: 'Authentication failed. Check your API key and URL.' });
        process.exit(1);
      }

      writeConfig({ url, token });
      console.log('Config saved to ~/.loop/config.json');
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(() => {
      writeConfig({});
      console.log('Logged out. Credentials cleared.');
    });

  auth
    .command('status')
    .description('Show current authentication state')
    .action(() => {
      const config = readConfig();
      if (config.token) {
        console.log('Authenticated');
        console.log(`  URL:   ${config.url || '(not set)'}`);
        console.log(`  Token: ${maskToken(config.token)}`);
      } else {
        console.log('Not authenticated. Run: loop auth login');
      }
    });
}
