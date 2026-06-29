FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY app.js ./
COPY services/ ./services/
COPY public/ ./public/

EXPOSE 8080

CMD ["node", "app.js"]
