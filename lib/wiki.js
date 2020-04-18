'use strict';

const debug = require('debug')('mozilla-contributions:wiki');
const axios = require('axios');
const { parseString } = require('xml2js');
const { promisify } = require('util');
const parseStringAsync = promisify(parseString);

const StorageHandler = require('./storage-handler');

const BASE_URL = 'https://wiki.mozilla.org/api.php?action=feedcontributions';

module.exports = {
  gather,
};

async function gather() {
  const {
    WIKI_USERNAME: wikiUsername,
  } = process.env;

  if (!wikiUsername) {
    debug('No Wiki username passed');
    return Promise.resolve();
  }

  const edits = await processEdits();
  await save(edits);

  debug('Finished saving contributions');
  return edits;
}

async function processEdits() {
  debug('Getting edits from Wiki');
  let allEdits = [];

  const latestSavedEdit = await getLatestBySource('wiki');
  const lowerBoundDate = latestSavedEdit[0] && new Date(latestSavedEdit[0].createdAt);
  const period = periodGenerator(lowerBoundDate);
  for await (const periodChunk of period) {
    debug(`Getting data for ${periodChunk[0]}/${periodChunk[1]}`);
    const edits = await getPage(periodChunk);
    debug(`Got ${edits.length} results to filter`);
    const processed = processEntities(edits, periodChunk);
    debug(`Got ${processed.length} results`);
    allEdits = allEdits.concat(processed);
  }

  return allEdits;
}

function getNextPeriod(period, lowerBoundDate) {
  const STOP_DATE = new Date(process.env.WIKI_STOP_DATE || '2010-01-01');
  const [month, year] = period;

  const nextDate = new Date(year, month - 1, 1);
  nextDate.setMonth(nextDate.getMonth() - 1);

  if (nextDate < STOP_DATE || nextDate < lowerBoundDate) {
    return [];
  }

  return [nextDate.getMonth() + 1, nextDate.getFullYear()];
}

async function* periodGenerator(lowerBoundDate) {
  const date = new Date();
  let currentPeriod = [date.getMonth() + 1, date.getFullYear()];
  while (true) {
    yield currentPeriod;
    currentPeriod = getNextPeriod(currentPeriod, lowerBoundDate);
    if (!currentPeriod.length) {
      debug(`We reached the stop date, we are done!`);
      return;
    }
  }
}

function getUrl({ user, month, year }) {
  return `${BASE_URL}&user=${user}&year=${year}&month=${month}`;
}

async function getPage([month, year]) {
  const {
    WIKI_USERNAME: wikiUsername,
  } = process.env;

  try {
    const url = getUrl({
      user: wikiUsername,
      month,
      year,
    });
    debug(`Getting ${url}`);
    const response = await axios.get(url);
    const parsed = await parse(response.data);
    const firstChannel = parsed.rss && parsed.rss.channel && parsed.rss.channel[0];
    const items = firstChannel && Array.isArray(firstChannel.item) ? firstChannel.item : [];
    return items;
  } catch (error) {
    debug('Error fetching edits', error);
    return [];
  }
}

function processEntities(entities, periodChunk) {
  return entities.map(format).filter((entity) => entity.createdAt.getMonth() + 1 == periodChunk[0] && entity.createdAt.getFullYear() == periodChunk[1]);
}

function getLatestBySource(source) {
  const instance = StorageHandler.getInstance();
  return instance.getLatestBySource(source);
}

function save(contributions) {
  const instance = StorageHandler.getInstance();
  return instance.saveContributions(contributions);
}

function format(entity) {
  return {
    createdAt: new Date(entity.pubDate),
    description: `Edited ${entity.title}`,
    link: entity.link[0],
    type: 'Wiki Edit',
    source: 'wiki',
  };
}

async function parse(xml) {
  try {
    const parsed = await parseStringAsync(xml);
    return parsed;
  } catch (error) {
    debug('Failed to parse', error);
    return {};
  }
}
