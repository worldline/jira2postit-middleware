//npm modules
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path')
const fs = require('fs')
const https = require('https')
const MemoryStore = require('memorystore')(session)
var config = require('./app/configuration/configuration');
const program = require('commander');

program
  .requiredOption('-j, --jira-url <url>', 'Jira base url, ex: https://jira.my.domain.com/rest')
  .option('-x, --proxy <ip:port>', 'Proxy address')
  .option('-w, --cors <ip:port>', 'Front address')
  .option('-k, --private-key <file>', 'HTTPS Private key certificate')
  .option('-c, --certificate <file>', 'HTTPS Certificate');
program.parse(process.argv);

// creates the server
const app = express();

// defines the port
const port = config.get('app:port');

// defines & adds the CORS options
const corsAddress = program.cors || config.get('cors:origin');
if (corsAddress) {
  var corsOptions = {
    origin: corsAddress,
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    credentials: true
  }
  app.use(cors(corsOptions));
}


// adds & configures the parser middleware
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())

// adds & configures the session middleware
app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000 // 24 hours
  }),
  cookie: {
    maxAge: config.get('session:cookieMaxAge'),
    secure: true,
    httpOnly: true,
    ephemeral: true
  },
  secret: config.get('session:salt'),
  resave: true,
  saveUninitialized: false,
  name: 'id',
  unset: 'destroy'
}));

// imports & registers the routes
var routes = require('./app/routes/jiraRoutes');
routes(app);

// adds & configures a wrong route middleware
app.use(function (req, res) {
  res.status(404).send({
    url: req.originalUrl + ' not found'
  })
});

// configures the https certificates
const certificatePath = program.certificate || './build/cert/server.crt';
const certificatePrivateKey = program.privateKey || './build/cert/server.key';
console.log(certificatePath);
console.log(certificatePrivateKey);
var certOptions = {
  key: fs.readFileSync(path.resolve(certificatePrivateKey)),
  cert: fs.readFileSync(path.resolve(certificatePath))
}

// tells the server what port to listen on
https.createServer(certOptions, app).listen(port, () => {
  console.log('jira2postit RESTful API server started on: ' + port);
});
