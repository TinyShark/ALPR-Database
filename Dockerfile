FROM node:18-bullseye AS builder
WORKDIR /app
COPY package.json next.config.js ./
RUN yarn install
COPY . .
RUN yarn build


FROM node:18-bullseye
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app /app
COPY --from=builder /app/package.json ./package.json
COPY server.js .
EXPOSE 3000
CMD ["yarn", "start"]