FROM node:18-alpine

WORKDIR /app

# Install bash, docker CLI, jq, and rclone
RUN apk add --no-cache bash docker-cli jq rclone

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application files
COPY backend ./backend
COPY frontend ./frontend

# Create data directory
RUN mkdir -p /app/data

# Make backup script executable
RUN chmod +x /app/backend/backup.sh

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
