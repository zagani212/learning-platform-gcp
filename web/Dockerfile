FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_AUTH_API_URL
ARG VITE_SCHOOLS_API_URL
ARG VITE_USERS_API_URL
ARG VITE_MEDIA_API_URL
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL
ENV VITE_SCHOOLS_API_URL=$VITE_SCHOOLS_API_URL
ENV VITE_USERS_API_URL=$VITE_USERS_API_URL
ENV VITE_MEDIA_API_URL=$VITE_MEDIA_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

