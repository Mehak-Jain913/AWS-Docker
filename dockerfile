# ---------- Frontend ----------
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./

RUN npm install

COPY frontend .

RUN npm run build


# ---------- Backend ----------
FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm install

COPY backend .

COPY --from=frontend-builder /app/dist ./public

EXPOSE 3000

CMD ["node", "server.js"]

#Difference in RUN and CMD In a Dockerfile, `RUN` and `CMD` serve different purposes:
#1. RUN: The `RUN` instruction is used to execute commands during the build process of the Docker image. It is typically used to install dependencies, set up the environment, or perform any other tasks that need to be done before the image is finalized. Each `RUN` command creates a new layer in the image.
#2. CMD: The `CMD` instruction is used to specify the default command that will be executed when a container is started from the image. It does not create a new layer and can be overridden by providing a different command when running the container. If multiple `CMD` instructions are specified, only the last one will take effect.