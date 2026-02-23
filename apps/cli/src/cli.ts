import { Command } from 'commander';
import { registerAuthCommand } from './commands/auth.js';
import { registerCommentsCommand } from './commands/comments.js';
import { registerConfigCommand } from './commands/config.js';
import { registerDispatchCommand } from './commands/dispatch.js';
import { registerGoalsCommand } from './commands/goals.js';
import { registerIssuesCommand } from './commands/issues.js';
import { registerLabelsCommand } from './commands/labels.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerSignalsCommand } from './commands/signals.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerTemplatesCommand } from './commands/templates.js';
import { registerCompletionsCommand } from './commands/completions.js';
import { registerTriageCommand } from './commands/triage.js';

const program = new Command()
  .name('loop')
  .description('Terminal-native interface to Loop')
  .version('0.2.0')
  .option('--json', 'Output raw JSON')
  .option('--plain', 'Output tab-separated values (no colors)')
  .option('--api-url <url>', 'Override API URL')
  .option('--token <token>', 'Override auth token');

registerAuthCommand(program);
registerConfigCommand(program);
registerIssuesCommand(program);
registerCommentsCommand(program);
registerSignalsCommand(program);
registerTriageCommand(program);
registerProjectsCommand(program);
registerGoalsCommand(program);
registerLabelsCommand(program);
registerTemplatesCommand(program);
registerDispatchCommand(program);
registerDashboardCommand(program);
registerCompletionsCommand(program);

export { program };
