import { Command } from 'commander';

const SUPPORTED_SHELLS = ['bash', 'zsh', 'fish'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

/**
 * Extract all command names and their subcommands from a Commander program.
 * Returns a map of command name to array of subcommand names.
 */
function extractCommands(program: Command): Map<string, string[]> {
  const commands = new Map<string, string[]>();

  for (const cmd of program.commands) {
    const subcommands = cmd.commands.map((sub) => sub.name());
    commands.set(cmd.name(), subcommands);
  }

  return commands;
}

/** Extract global option flags from a Commander program. */
function extractGlobalOptions(program: Command): string[] {
  return program.options.flatMap((opt) => {
    const flags: string[] = [];
    if (opt.short) flags.push(opt.short);
    if (opt.long) flags.push(opt.long);
    return flags;
  });
}

/** Generate a Bash completion script for the loop CLI. */
function generateBashScript(program: Command): string {
  const commands = extractCommands(program);
  const globalOptions = extractGlobalOptions(program);
  const topLevelCommands = [...commands.keys(), 'completions'];

  const subcommandCases = [...commands.entries()]
    .filter(([, subs]) => subs.length > 0)
    .map(([name, subs]) => `      ${name}) COMPREPLY=($(compgen -W "${subs.join(' ')}" -- "$cur")) ;;`)
    .join('\n');

  return `# Bash completion for loop CLI
# Usage: eval "$(loop completions bash)"
# Or:    loop completions bash >> ~/.bashrc

_loop_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="${topLevelCommands.join(' ')}"
  local global_opts="${globalOptions.join(' ')}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "\${commands} \${global_opts} --help --version" -- "$cur"))
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
${subcommandCases}
      completions) COMPREPLY=($(compgen -W "${SUPPORTED_SHELLS.join(' ')}" -- "$cur")) ;;
      *) COMPREPLY=($(compgen -W "--help" -- "$cur")) ;;
  esac
}

complete -F _loop_completions loop
`;
}

/** Generate a Zsh completion script for the loop CLI. */
function generateZshScript(program: Command): string {
  const commands = extractCommands(program);
  const topLevelCommands = [...commands.keys(), 'completions'];

  const subcommandCases = [...commands.entries()]
    .filter(([, subs]) => subs.length > 0)
    .map(([name, subs]) => {
      const subsStr = subs.map((s) => `'${s}:${s} subcommand'`).join(' ');
      return `    ${name})\n      _values 'subcommand' ${subsStr}\n      ;;`;
    })
    .join('\n');

  const topLevelDescriptions = topLevelCommands
    .map((name) => `    '${name}:${name} command'`)
    .join(' \\\n');

  return `#compdef loop
# Zsh completion for loop CLI
# Usage: eval "$(loop completions zsh)"
# Or:    loop completions zsh > ~/.zsh/completions/_loop

_loop() {
  local -a commands
  local state

  _arguments -C \\
    '--json[Output raw JSON]' \\
    '--plain[Output tab-separated values]' \\
    '--api-url[Override API URL]:url:' \\
    '--token[Override auth token]:token:' \\
    '--help[Show help]' \\
    '--version[Show version]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
  command)
    _values 'command' \\
${topLevelDescriptions}
    ;;
  args)
    case \${words[1]} in
${subcommandCases}
    completions)
      _values 'shell' ${SUPPORTED_SHELLS.map((s) => `'${s}'`).join(' ')}
      ;;
    esac
    ;;
  esac
}

_loop "$@"
`;
}

/** Generate a Fish completion script for the loop CLI. */
function generateFishScript(program: Command): string {
  const commands = extractCommands(program);
  const topLevelCommands = [...commands.keys(), 'completions'];

  const lines = [
    '# Fish completion for loop CLI',
    '# Usage: loop completions fish | source',
    '# Or:    loop completions fish > ~/.config/fish/completions/loop.fish',
    '',
    '# Disable file completions by default',
    'complete -c loop -f',
    '',
    '# Global options',
    "complete -c loop -l json -d 'Output raw JSON'",
    "complete -c loop -l plain -d 'Output tab-separated values'",
    "complete -c loop -l api-url -d 'Override API URL' -r",
    "complete -c loop -l token -d 'Override auth token' -r",
    '',
    '# Top-level commands',
  ];

  for (const name of topLevelCommands) {
    lines.push(
      `complete -c loop -n '__fish_use_subcommand' -a '${name}' -d '${name} command'`
    );
  }

  lines.push('');
  lines.push('# Subcommands');

  for (const [name, subs] of commands) {
    for (const sub of subs) {
      lines.push(
        `complete -c loop -n '__fish_seen_subcommand_from ${name}' -a '${sub}' -d '${sub} subcommand'`
      );
    }
  }

  // completions subcommand
  for (const shell of SUPPORTED_SHELLS) {
    lines.push(
      `complete -c loop -n '__fish_seen_subcommand_from completions' -a '${shell}' -d '${shell} completions'`
    );
  }

  lines.push('');
  return lines.join('\n');
}

const GENERATORS: Record<Shell, (program: Command) => string> = {
  bash: generateBashScript,
  zsh: generateZshScript,
  fish: generateFishScript,
};

/** Register the `completions` command for outputting shell completion scripts. */
export function registerCompletionsCommand(program: Command): void {
  program
    .command('completions')
    .description('Output shell completion scripts')
    .argument('[shell]', `Shell type (${SUPPORTED_SHELLS.join(', ')})`)
    .addHelpText(
      'after',
      `
Examples:
  eval "$(loop completions bash)"        # Enable in current bash session
  eval "$(loop completions zsh)"         # Enable in current zsh session
  loop completions fish | source         # Enable in current fish session
  loop completions bash >> ~/.bashrc     # Persist for bash
  loop completions zsh > ~/.zsh/completions/_loop  # Persist for zsh
  loop completions fish > ~/.config/fish/completions/loop.fish  # Persist for fish`
    )
    .action((shell?: string) => {
      if (!shell) {
        const detected = detectShell();
        if (detected) {
          console.log(GENERATORS[detected](program));
          return;
        }
        console.error(
          `Could not detect shell. Please specify one of: ${SUPPORTED_SHELLS.join(', ')}`
        );
        process.exit(1);
      }

      if (!isValidShell(shell)) {
        console.error(`Unsupported shell: ${shell}. Supported: ${SUPPORTED_SHELLS.join(', ')}`);
        process.exit(1);
      }

      console.log(GENERATORS[shell](program));
    });
}

/** Detect the current shell from the SHELL environment variable. */
function detectShell(): Shell | null {
  const shellPath = process.env.SHELL ?? '';
  for (const shell of SUPPORTED_SHELLS) {
    if (shellPath.endsWith(`/${shell}`)) {
      return shell;
    }
  }
  return null;
}

function isValidShell(value: string): value is Shell {
  return SUPPORTED_SHELLS.includes(value as Shell);
}
