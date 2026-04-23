FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

# Build client
COPY client/ ./client/
RUN npm run build --workspace=client

# Build server
COPY server/ ./server/
RUN npm run build --workspace=server

# Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/public ./public
COPY --from=base /app/server/package.json ./server/
RUN cd server && npm install --omit=dev
RUN mkdir -p data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/dist/index.js"]
