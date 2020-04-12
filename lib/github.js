'use strict';

const debug = require('debug')('mozilla-contributions:github');
const { Octokit } = require('@octokit/rest');

const StorageHandler = require('./storage-handler');

const RESULTS_PER_PAGE = 100;
const DELAY_FETCHING_MS = 2000;

const STOP_DATE = new Date(process.env.GITHUB_STOP_DATE || '2010-01-01');
let octokit;

module.exports = {
  gather,
};

async function gather() {
  const {
    GITHUB_TOKEN: githubToken,
    GITHUB_USERNAME: githubUsername,
  } = process.env;

  if (!githubToken) {
    debug('No GitHub token passed');
    return Promise.resolve();
  }

  if (!githubUsername) {
    debug('No GitHub username passed');
    return Promise.resolve();
  }

  debug('Initializing Octokit');
  // Once https://github.com/octokit/plugin-throttling.js/issues/109 is fixed
  // we should use the throttle plugin and remove our own pagination
  octokit = new Octokit({
    auth: githubToken,
  });

  const issues = await processIssues();
  const commits = await processCommits();
  const contributions = [
    ...issues,
    ...commits,
  ];

  await save(contributions);

  debug('Finished saving contributions');
  return contributions;
}

async function processIssues() {
  debug('Getting issues from Github');
  return [];
}

async function processCommits() {
  debug('Getting commits from Github');
  const allCommits = [];

  const period = periodGenerator();
  for await (const periodChunk of period) {
    const page = pageGenerator(periodChunk, getCommitPage);
    for await (const commits of page) {
      debug(`Got ${commits.length} commits`);
      allCommits.push(commits);
    }
  }

  return allCommits.flat();
}

function getNextPeriod(period) {
  const [before, after] = period;

  // First of the previous month
  const afterDate = new Date(after);
  afterDate.setMonth(afterDate.getMonth() - 1);
  const newAfterDay = `01`;
  const newAfterMonth = getPadded(afterDate.getMonth() + 1);
  const newAfterYear = afterDate.getFullYear();
  const newAfterDate = `${newAfterYear}-${newAfterMonth}-${newAfterDay}`;

  // Last of the previous month
  const beforeDate = new Date(before);
  beforeDate.setDate(0);
  const newBeforeDay = beforeDate.getDate();
  const newBeforeMonth = getPadded(beforeDate.getMonth() + 1);
  const newBeforeYear = beforeDate.getFullYear();
  const newBeforeDate = `${newBeforeYear}-${newBeforeMonth}-${newBeforeDay}`;

  if (beforeDate < STOP_DATE) {
    return [];
  }

  return [newBeforeDate, newAfterDate];
}

function getPadded(number) {
  if (number < 10) {
    return `0${number}`;
  }

  return `${number}`;
}

async function* periodGenerator() {
  let currentPeriod = ['2020-04-30', '2020-04-01'];
  while (true) {
    yield currentPeriod;
    currentPeriod = getNextPeriod(currentPeriod);
    if (!currentPeriod.length) {
      debug(`We reached the stop date of ${STOP_DATE}, we are done!`);
      return;
    }
  }
}

async function* pageGenerator(period, cb) {
  debug(`Getting commits for period between ${period[1]} and ${period[0]}`);
  let hasMoreToFetch = true;
  let page = 1;
  while (hasMoreToFetch) {
    const results = await cb(period, page);
    debug(`Got ${results.length} results to filter`);
    // If we have less results than the max result, we're at the end
    // Special case: GitHub doesn't let us fetch more than 10 pages, so we just
    // pretend we are done for that period..
    if (results.length < RESULTS_PER_PAGE || page === 10) {
      hasMoreToFetch = false;
      yield processEntities(results);
      return;
    }

    page++;
    yield processEntities(results);
  }
}

async function getCommitPage(commitsPeriod, page) {
  const {
    GITHUB_USERNAME: githubUsername,
  } = process.env;

  const [before, after] = commitsPeriod;

  debug(`Getting commits page ${page} between ${after} and ${before}`);
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const response = await octokit.search.commits({
          q: `author:${githubUsername}+author-date:${after}..${before}`,
          sort: 'committer-date',
          per_page: RESULTS_PER_PAGE, // eslint-disable-line camelcase
          page,
        });

        return resolve(response.data.items);
      } catch (error) {
        debug('Error fetching commits', error);
        return [];
      }
    }, DELAY_FETCHING_MS);
  });
}

function processEntities(entities) {
  return entities.filter(filter).map(format);
}

function save(contributions) {
  const instance = StorageHandler.getInstance();
  return instance.saveContributions(contributions);
}

function filter(entity) {
  const {
    GITHUB_FILTER: githubFilter,
  } = process.env;

  if (!githubFilter) {
    return true;
  }

  const regex = new RegExp(githubFilter, 'i');
  const matchesRegex = regex.test(entity.html_url);
  const isFork = entity.repository.fork;
  return matchesRegex && !isFork;
}

function format(entity) {
  if (entity.commit) {
    return formatCommit(entity);
  }

  return formatIssue(entity);
}

function formatCommit(entity) {
  const createdAt = new Date(entity.commit.author.date);
  let description = '';
  let link = '';

  if (entity.repository.private) {
    description = 'Commit in private repository';
  } else {
    description = `${entity.repository.owner.login}/${entity.repository.name}: ${entity.commit.message}`;
    link = entity.html_url;
  }

  return {
    createdAt,
    description,
    link,
    type: 'GitHub Commit',
    source: 'github',
  };
}

function formatIssue(entity) {
  return entity;
}
