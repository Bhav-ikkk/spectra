FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile && pnpm -r build

FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY --from=builder /app .
ENV HOST=0.0.0.0 PORT=10000
EXPOSE 10000
CMD ["pnpm", "start"]

