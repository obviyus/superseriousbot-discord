FROM oven/bun:latest AS builder

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build --compile --minify --sourcemap ./index.ts --outfile bot

FROM gcr.io/distroless/cc-debian12

COPY --from=builder /app/bot /bot

CMD ["/bot"]
