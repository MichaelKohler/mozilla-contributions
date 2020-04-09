FROM node:12-alpine

COPY . /app

WORKDIR '/app'

RUN npm ci

EXPOSE 3333

CMD ["npm", "start"]