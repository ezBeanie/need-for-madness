# The relay of multiplayer races (see relay.js). Built from the project root:
# docker build -f server/Dockerfile -t nfm-relay .
FROM node:20-alpine
WORKDIR /relay
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
USER node
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/main.js"]
