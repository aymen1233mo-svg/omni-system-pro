FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build application
COPY . .
RUN npm run build

# Expose HTTP port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/var/data/pos.db

CMD ["npm", "start"]
