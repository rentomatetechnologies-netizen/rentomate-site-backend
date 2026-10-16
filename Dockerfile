# RentOMate API
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
# `prisma generate` doesn't connect to the database, but the config expects a URL.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json prisma.config.ts ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
# Apply pending migrations, create the first admin / starter posts if the database is empty, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/scripts/seed.js && node dist/server.js"]
