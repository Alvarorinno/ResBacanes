FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY Codigos/backend/package*.json ./backend/
RUN cd backend && npm install

# Install and build frontend
COPY Codigos/frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY Codigos/frontend/ ./frontend/
RUN cd frontend && npm run build && cp -r dist ../backend/dist

# Copy backend source
COPY Codigos/backend/ ./backend/

EXPOSE 3001

CMD ["node", "backend/server.js"]
