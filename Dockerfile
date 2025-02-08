# Use a lightweight Node.js image
FROM node:16-alpine

# Create app directory inside container
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# If you want to copy .env, do it here (Optional)
# COPY .env ./.env

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["node", "deploy.js"]
