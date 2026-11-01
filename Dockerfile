FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY benchmark ./benchmark
COPY .spectra ./.spectra
COPY assets ./assets
COPY docs ./docs
COPY README.md JUDGING.md ./

RUN pnpm install --frozen-lockfile
RUN pnpm -r build

ENV NODE_ENV=production
ENV SPECTRA_PUBLIC_DEMO=true
ENV PORT=4173
EXPOSE 4173

CMD ["pnpm", "--filter", "@spectra/workbench", "start"]
