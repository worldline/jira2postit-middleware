var nconf = require('nconf');

function Config() {
  nconf.argv().env();
  var environment = nconf.get('NODE_ENV') || 'development';
  nconf.file(environment, './app/configuration/' + environment.toLowerCase() + '.json');
}

Config.prototype.get = function(key) {
  return nconf.get(key);
};

module.exports = new Config();
