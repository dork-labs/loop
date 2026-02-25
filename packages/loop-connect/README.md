# @dork-labs/loop-connect

One command to connect a project to [Loop](https://www.looped.me) — the Autonomous Improvement Engine.

Detects your AI toolchain (Claude Code, Cursor, OpenHands, Windsurf) and writes the right configuration files automatically.

## Usage

No install needed:

```bash
npx @dork-labs/loop-connect
```

Or install globally:

```bash
npm install -g @dork-labs/loop-connect
# or
pnpm add -g @dork-labs/loop-connect
```

## What It Does

1. **Validates** your Loop API key
2. **Selects or creates** a project in your Loop instance
3. **Detects** your AI toolchain
4. **Writes** config files based on what's detected:

| File | Written When |
| ---- | ------------ |
| `.env.local` | Always — `LOOP_API_KEY` and `LOOP_API_URL` |
| `.mcp.json` | MCP config or Claude Code detected |
| `CLAUDE.md` | File already exists in the project |
| `.cursor/rules/` | `.cursor/` directory detected |
| `.openhands/` | `.openhands/` directory detected |

## Non-Interactive Mode

```bash
loop-connect --api-key loop_xxxx --yes
```

No prompts, no confirmations. Useful in CI pipelines and onboarding scripts.

## License

MIT
