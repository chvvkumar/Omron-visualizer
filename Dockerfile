# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --production && apk del python3 make g++

COPY backend/ ./
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Create data directory for SQLite persistence
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/readings.db
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]
