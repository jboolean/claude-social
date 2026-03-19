# claude-social

A bot that gives Claude an autonomous social presence in a Slack channel. It periodically wakes up, reads recent messages, and decides whether to respond — staying in character as a persona you define.

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure the Slack plugin

The bot runs Claude as a subprocess with an isolated config directory (`claude-config/`). You need to install and authenticate the Slack plugin there:

```sh
CLAUDE_CONFIG_DIR=./claude-config claude
```

Inside that session, run `/install slack@claude-plugins-official` and complete the OAuth flow. You only need to do this once.

### 3. Create `config.json`

Copy `config.example.json` to `config.json` and fill in the values:

```json
{
  "channelId": "C0AL1DJAEDQ",
  "slackUserId": "U09J7D85VAN",
  "model": "claude-haiku-4-5",
  "minDelayMinutes": 1,
  "maxDelayMinutes": 20
}
```

| Field | Description |
|---|---|
| `channelId` | Slack channel ID to read and post in |
| `slackUserId` | The Slack user ID of the account the bot posts as (so it can recognize its own prior messages) |
| `model` | Claude model to use for each invocation |
| `minDelayMinutes` | Minimum minutes to wait between checks |
| `maxDelayMinutes` | Maximum minutes to wait between checks |

The bot (Claude) also reads `nextDelayMinutes` from `state.json` after each run and uses that as the next delay, clamped to the configured min/max. This lets it check back sooner when conversation is active.

### 4. Create `CHARACTER.md`

Write a character sheet describing the persona. Claude reads this before every invocation to understand who it is. See the Character Sheet section below for what to include.

### 5. Initialize `MEMORY.md` and `state.json`

```sh
echo "" > MEMORY.md
echo '{}' > state.json
```

Claude updates both files after each run — `MEMORY.md` with anything worth remembering, `state.json` with the latest message timestamp and next delay.

## Running

```sh
npx tsx index.ts
```

### CLI options

| Flag | Description |
|---|---|
| `--once` | Run a single invocation and exit (no loop, no initial delay). Useful for testing. |
| `--isolate` | Use `./claude-config` as the subprocess config dir (default). Keeps the bot's Claude instance isolated from your personal Claude config. |
| `--no-isolate` | Use your default Claude config instead of `./claude-config`. The Slack plugin must be installed and authenticated there. |

## Character Sheet

`CHARACTER.md` is freeform — Claude reads it verbatim. At minimum, include:

- Who the character is and their background
- Personality traits, speech patterns, things they care about
- How they engage with others

The more vivid the character, the more consistent the behavior.

## Files

| File | Tracked | Description |
|---|---|---|
| `config.json` | No | Runtime config (channel, model, delays) |
| `CHARACTER.md` | No | Persona definition — write this yourself |
| `MEMORY.md` | No | Persistent memory — Claude writes to this |
| `state.json` | No | Runtime state (last seen message, next delay) |
| `claude-config/` | No | Isolated Claude config dir with Slack plugin auth |
