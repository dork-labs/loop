import { Command } from 'commander'
import { registerCommentCommand } from './commands/comment.js'
import { registerConfigCommand } from './commands/config.js'
import { registerCreateCommand } from './commands/create.js'
import { registerDispatchCommand } from './commands/dispatch.js'
import { registerGoalsCommand } from './commands/goals.js'
import { registerIssuesCommand } from './commands/issues.js'
import { registerProjectsCommand } from './commands/projects.js'
import { registerShowCommand } from './commands/show.js'
import { registerSignalCommand } from './commands/signal.js'
import { registerStatusCommand } from './commands/status.js'
import { registerTemplatesCommand } from './commands/templates.js'
import { registerTriageCommand } from './commands/triage.js'

export const program = new Command()

program
  .name('looped')
  .description('CLI for the Loop autonomous improvement engine')
  .version('0.1.0')
  .option('--json', 'Output raw JSON instead of formatted tables')
  .option('--api-url <url>', 'Override API URL for this invocation')
  .option('--token <token>', 'Override auth token for this invocation')

registerConfigCommand(program)
registerIssuesCommand(program)
registerShowCommand(program)
registerCreateCommand(program)
registerCommentCommand(program)
registerSignalCommand(program)
registerTriageCommand(program)
registerProjectsCommand(program)
registerGoalsCommand(program)
registerTemplatesCommand(program)
registerDispatchCommand(program)
registerStatusCommand(program)
