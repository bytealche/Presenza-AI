FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
