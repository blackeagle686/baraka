# Use standard lightweight Nginx alpine image
FROM nginx:alpine

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx reverse-proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files into nginx public directory
COPY . /usr/share/nginx/html

# Expose Nginx port
EXPOSE 80

# Start Nginx server in the foreground
CMD ["nginx", "-g", "daemon off;"]
