'use strict';

const debug = require('debug')('mozilla-contributions:index');
const gather = require('./lib/gather');
const storageHandler = require('./lib/storage-handler');

const http = require('http');
const app = require('./app');

const port = process.env.PORT || '3333';
app.set('port', port);

const server = http.createServer(app);

server.listen(port);
server.on('listening', () => {
  const addr = server.address();
  debug(`Listening on ${addr.port}`);
});

(async function() {
  const storageInstance = storageHandler.getInstance();
  await storageInstance.connect();
  await gather.start();
})();
