FROM node:22-alpine

WORKDIR /app

COPY ui/package.json ui/package-lock.json* ./
RUN npm install

COPY ui/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]
