/* eslint security/detect-non-literal-fs-filename: 0 */

'use strict';

const debug = require('debug')('mozilla-contributions:gather');
const cron = require('node-cron');

const reps = require('./reps');

module.exports = {
  start,
};

async function start() {
  const { FETCH } = process.env;
  if (!FETCH || FETCH !== 'true') {
    debug('FETCH is not enabled, not fetching..');
    return Promise.resolve();
  }

  debug('registering cronjob..');
  cron.schedule('0 45 * * * *', () => {
    fetchAll()
      .catch((err) => {
        debug('CRONJOB_FETCH_FAILED', err);
      });
  });

  return fetchAll();
}

async function fetchAll() {
  debug('fetching...');

  await reps.processActivities();
}
