FROM node:12-alpine

# Create app directory
WORKDIR /usr/src/app
VOLUME /usr/src/data
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY server.js build app ./

EXPOSE 8000

ENTRYPOINT [ "npm", "start", "--"]
