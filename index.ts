import { spawn } from "child_process";
import { readFileSync } from "fs";

interface Config {
  channelId: string;
  slackUserId: string;
  model: string;
  minDelayMinutes: number;
  maxDelayMinutes: number;
}

function loadConfig(): Config {
  const config: Config = JSON.parse(readFileSync("config.json", "utf-8"));
  if (!config.channelId || config.channelId === "REPLACE_ME") {
    console.error("Error: set channelId in config.json before running.");
    process.exit(1);
  }
  return config;
}

function randomDelay(min: number, max: number): number {
  return (Math.random() * (max - min) + min) * 60 * 1000;
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function runClaude(prompt: string, model: string): Promise<void> {
  const args = [
    "-p",
    prompt,
    "--allowedTools",
    [
      "mcp__plugin_slack_slack__*",
      "Read",
      "Write",
      "WebSearch",
    ].join(","),
    "--model",
    model,
  ];
  log(`Spawning: claude ${args.map((a, i) => i === 1 ? "<prompt>" : a).join(" ")}`);

  return new Promise((resolve, reject) => {
    const env = isolate ? { ...process.env, CLAUDE_CONFIG_DIR: "./claude-config" } : process.env;
    const proc = spawn("/opt/homebrew/bin/claude", args, { stdio: ["inherit", "pipe", "pipe"], env });

    proc.stdout!.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text);
      if (/permission|not allowed|denied|blocked|unauthorized/i.test(text)) {
        log(`[PERMISSION] ${text.trim()}`);
      }
    });

    proc.stderr!.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(text);
      if (/permission|not allowed|denied|blocked|unauthorized/i.test(text)) {
        log(`[PERMISSION] ${text.trim()}`);
      }
    });

    proc.on("close", (code, signal) => {
      log(`claude exited: code=${code} signal=${signal}`);
      if (code === 0) resolve();
      else reject(new Error(`claude exited with code ${code}`));
    });

    proc.on("error", (err) => {
      log(`Failed to spawn claude: ${err.message}`);
      reject(err);
    });
  });
}

process.on("SIGINT", () => process.exit(0));

const config = loadConfig();
const once = process.argv.includes("--once");
const isolate = process.argv.includes("--isolate") || !process.argv.includes("--no-isolate");

function buildPrompt(channelId: string, slackUserId: string): string {
  const now = new Date().toISOString();
  return `The current time is ${now}.

Read CHARACTER.md to understand who you are, then read MEMORY.md for context from previous sessions.

Use the Slack MCP tools to read the latest messages in Slack channel ${channelId} and its threads. Check state.json for .lastMessageTs to know what you've already seen — only consider messages newer than that timestamp. Use Slack MCP tools to post if you decide to respond.

Important: you post messages via Slack user ${slackUserId}. Any messages from that user ID in the channel are your own prior messages — not someone else's. It will have a different display name from your character's.

Decide whether you'd like to respond. Skip if there are no new messages or nothing worth saying. If you do respond, **post only to channel ${channelId} and its threads** — never any other channel. You may also choose to initiate a new conversation in channel ${channelId}. 
You may also create Slack canvases to create shared documents and share them with the channel.


Stay in character at all times.

Afterwards, update MEMORY.md with anything worth remembering or to expand our character's story. Update state.json with:
- .lastMessageTs: the timestamp of the most recent message you read
- .nextDelayMinutes: how many minutes until you should check again (a number between ${config.minDelayMinutes} and ${config.maxDelayMinutes}). Use your judgment — check back sooner if the conversation is active, later if things are quiet.`;
}

function readNextDelay(): number {
  try {
    const state = JSON.parse(readFileSync("state.json", "utf-8"));
    if (typeof state.nextDelayMinutes === "number") {
      const clamped = Math.min(Math.max(state.nextDelayMinutes, config.minDelayMinutes), config.maxDelayMinutes);
      return clamped * 60 * 1000;
    }
  } catch {}
  return randomDelay(config.minDelayMinutes, config.maxDelayMinutes);
}

do {
 
  log("Invoking claude...");
  try {
    await runClaude(buildPrompt(config.channelId, config.slackUserId), config.model);
    log("claude completed successfully.");
  } catch (err) {
    log(`claude error: ${err}`);
  }

  if (!once) {
    const delay = readNextDelay();
    const minutes = (delay / 60000).toFixed(1);
    log(
      `Waiting ${minutes} minutes (next delay from state.json or random fallback)...`,
    );
    await new Promise((r) => setTimeout(r, delay));
  }

} while (!once);
