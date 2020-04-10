'use strict';

const gather = require('./lib/gather');
const storageHandler = require('./lib/storage-handler');

(async function() {
  const storageInstance = storageHandler.getInstance();
  await storageInstance.connect();
  await gather.start();
})();
