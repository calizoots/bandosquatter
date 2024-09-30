FROM node:22

RUN npm install -g node-pre-gyp && npm install -g nodemon && npm install -g tsx

WORKDIR /usr/src/app

COPY package*.json yarn.lock ./ 

RUN yarn

COPY . .

EXPOSE 3001

RUN npx prisma generate

CMD ["echo", "choose this in docker compose"]