FROM node:22-bookworm-slim AS build
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
COPY contracts/ /app/contracts/
ARG NEXT_PUBLIC_API_URL=http://localhost:8140/api/v2
ARG NEXT_PUBLIC_QC_DEMO_LOGIN_ENABLED=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_QC_DEMO_LOGIN_ENABLED=$NEXT_PUBLIC_QC_DEMO_LOGIN_ENABLED
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/frontend
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_QC_DEMO_LOGIN_ENABLED=true
COPY --from=build --chown=node:node /app/frontend/.next ./.next
COPY --from=build --chown=node:node /app/frontend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/frontend/public ./public
COPY --from=build --chown=node:node /app/frontend/package.json ./package.json
COPY --from=build --chown=node:node /app/frontend/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
