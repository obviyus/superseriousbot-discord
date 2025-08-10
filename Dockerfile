FROM oven/bun:latest

WORKDIR /app

ENV NODE_ENV=production

COPY bun.lockb package.json ./
RUN bun install --frozen-lockfile --production

COPY . .

CMD ["bun", "run", "index.ts"]
