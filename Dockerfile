FROM node:22-alpine

# Install build tools for sqlite3 native bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (all, including sqlite3 native bindings)
RUN npm install

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Remove build tools to reduce image size
RUN apk del python3 make g++

# Create data directory for SQLite
RUN mkdir -p backend/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Run as non-root user for security
USER node

CMD ["node", "backend/server.js"]
