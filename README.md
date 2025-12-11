# superseriousbot-discord

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

Environment variables:

```
DISCORD_TOKEN=your_token_here
# Optional for faster iteration; registers slash commands only in this guild if set
GUILD_ID=123456789012345678
```

To build and run with Docker:

```bash
docker build -t superseriousbot-discord . && docker run -d -e DISCORD_TOKEN=your_token_here superseriousbot-discord
```
