# Stage 1: Build frontend assets
FROM node:lts-bookworm AS builder

WORKDIR /app

# Copy package.json and package-lock.json
#COPY package*.json ./

# Install dependencies
#RUN npm install

# Copy all frontend files
COPY . .

# For a simple static site, no explicit build step might be needed,
# but if you had a framework like React/Vue, you'd run `npm run build` here.
# For NVL, we just need the node_modules to be accessible.

# Stage 2: Serve with Nginx
FROM nginx:stable-bookworm

# Copy Nginx configuration
COPY ./nginx-conf/default.conf /etc/nginx/conf.d/default.conf

# Copy built assets from the builder stage
COPY --from=builder /app /usr/share/nginx/data2int-web

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]