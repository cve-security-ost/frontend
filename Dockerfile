FROM node:20-slim AS builder

WORKDIR /app

COPY cve/package*.json ./
RUN npm install

COPY cve/ .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]