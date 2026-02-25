# @dork-labs/loop-cli

Terminal interface for [Loop](https://www.looped.me) — the Autonomous Improvement Engine.

Manage issues, signals, projects, and prompt templates from the shell.

## Installation

```bash
npm install -g @dork-labs/loop-cli
# or
pnpm add -g @dork-labs/loop-cli
```

## Setup

```bash
loop auth
```

Prompts for your API key and saves credentials locally.

## Commands

| Command | Description |
| ------- | ----------- |
| `loop auth` | Authenticate and save credentials |
| `loop config` | View or set configuration |
| `loop issues list` | List issues |
| `loop issues create` | Create a new issue |
| `loop issues start <id>` | Mark issue as in-progress |
| `loop issues done <id>` | Mark issue as done |
| `loop dispatch` | Claim the next priority task |
| `loop signals ingest` | Ingest a signal |
| `loop triage` | Accept or decline triaged signals |
| `loop projects list` | List projects |
| `loop goals list` | List goals |
| `loop dashboard` | View system health |
| `loop templates list` | List prompt templates |

## Output Formats

```bash
loop issues list --json     # raw JSON
loop issues list --plain    # tab-separated (pipe-friendly)
```

## Global Options

```bash
loop --api-url <url>     # override API URL
loop --token <token>     # override auth token
```

## Shell Completions

```bash
loop completions bash >> ~/.bashrc
loop completions zsh  >> ~/.zshrc
loop completions fish  > ~/.config/fish/completions/loop.fish
```

## License

MIT
