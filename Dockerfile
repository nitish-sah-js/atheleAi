FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build && echo "=== dist contents ===" && ls -la /app/dist/ && echo "=== end ==="
ENV NODE_ENV=production
EXPOSE 4000
CMD sh -c "echo '=== runtime dist ===' && ls -la /app/dist/ && echo '=== end ===' && node /app/dist/main.js"
