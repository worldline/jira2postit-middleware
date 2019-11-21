# jira2postit-middleware

This is the backend of the jira2postit project

## Application

This application acts as a middleware between the jira2postit angular app and your jira software instance. It also stores printing settings related to each board.

The possible arguments of the application are:
- required   
`-j, --jira-url`: Jira instance base url (ex: https://jira.my.domain.com/rest').    Always add `/rest` at the end of the domain.

- optional   
`-x, --proxy`: Proxy address   
`-w, --cors`: Front address (ex: https://my.front.domain)   
`-k, --private-key`: HTTPS private key certificate path   
`-c, --certificate`: HTTPS certificate path   

## Development server
To start the server locally with automatic reload on file saving, type:
- Linux, MacOS
```
npm run dev -- -j http://your.jira.domain/rest -w https://localhost:4200
```
- Windows
```
set NODE_ENV=development
nodemon server.js -j http://your.jira.domain/rest -w https://localhost:4200
```

Navigate to `https://localhost:8000/login` and accept the security exception due to the auto-signed ssl certificate. Your front will then be able to communicate with the middleware.

## Production server
- Linux, MacOS
```
npm run start -- -j http://your.jira.domain/rest -w https://your.jira2postit.front.domain
```
- Windows
```
set NODE_ENV=production
node server.js -j http://your.jira.domain/rest -w https://your.jira2postit.front.domain
```

## Docker
- Build the image:
```
docker build -t image-name .
```

- Run the container:
```
docker run -d -p 8000:8000 image-name -j http://your.jira.instance.domain/rest
```

- Run with a mounted volume:
To ensure your data is persisted, mount a volume, you should also provide your jira2postit front domain for CORS policy
```
docker run -d -p 8000:8000 --name container-name -v database/path/on/host:/usr/src/data image-name -j http://your.jira.instance.domain/rest -w https://your.jira2postit.front.domain
```

- Full exemple:
If you have a local jira instance running on port 8081 and a front on port 4200 and want to persist the data in the folder /tmp/data, this is the command to type
```
docker build -t jira-middleware .

docker run -d -p 8000:8000 --name middleware -v tmp/data:/usr/src/data jira-middleware -j http://host.docker.internal:8081/rest -w https://localhost:4200
