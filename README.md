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

This project was created using `bun init` in bun v1.1.38. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
