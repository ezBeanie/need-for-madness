# The relay of multiplayer races (see relay.js). Built from the project root:
# docker build -f server/Dockerfile -t nfm-relay .
FROM node:20-alpine
WORKDIR /relay
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
# the countries of the games opened (see geo.js): DB-IP's free database of this month,
# fetched as the image is built (without it the countries stay unknown)
RUN wget -q -O countries.csv.gz \
    "https://download.db-ip.com/free/dbip-country-lite-$(date +%Y-%m).csv.gz" \
  || rm -f countries.csv.gz
ENV GEOIP_FILE=/relay/countries.csv.gz
USER node
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/main.js"]
