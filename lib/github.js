'use strict';

const debug = require('debug')('mozilla-contributions:github');

const fetcher = require('./fetcher');
const StorageHandler = require('./storage-handler');

const RESULTS_PER_PAGE = fetcher.GITHUB_RESULTS_PER_PAGE;
const DEFAULT_DELAY_MS = 2000;

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

  fetcher.init({ githubToken });

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
  const allIssues = [];

  const latestSavedIssue = await getLatestBySource('github-issues');
  const lowerBoundDate = latestSavedIssue[0] && new Date(latestSavedIssue[0].createdAt);
  const period = periodGenerator(lowerBoundDate);
  for await (const periodChunk of period) {
    const page = pageGenerator(periodChunk, getIssuePage);
    for await (const issues of page) {
      debug(`Got ${issues.length} issues`);
      allIssues.push(issues);
    }
  }

  return allIssues.flat();
}

async function processCommits() {
  debug('Getting commits from Github');
  const allCommits = [];

  const latestSavedCommit = await getLatestBySource('github');
  const lowerBoundDate = latestSavedCommit[0] && new Date(latestSavedCommit[0].createdAt);
  const period = periodGenerator(lowerBoundDate);
  for await (const periodChunk of period) {
    const page = pageGenerator(periodChunk, getCommitPage);
    for await (const commits of page) {
      debug(`Got ${commits.length} commits`);
      allCommits.push(commits);
    }
  }

  return allCommits.flat();
}

function getNextPeriod(period, lowerBoundDate) {
  const STOP_DATE = new Date(process.env.GITHUB_STOP_DATE || '2010-01-01');
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

  if (beforeDate < STOP_DATE || beforeDate < lowerBoundDate) {
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

async function* periodGenerator(lowerBoundDate) {
  const date = new Date();
  const firstOfThisMonth = `${date.getFullYear()}-${getPadded(date.getMonth() + 1)}-01`;
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  const lastOfThisMonth = `${date.getFullYear()}-${getPadded(date.getMonth() + 1)}-${date.getDate()}`;
  const afterDate =
    lowerBoundDate
      ? `${lowerBoundDate.getFullYear()}-${getPadded(lowerBoundDate.getMonth() + 1)}-${getPadded(lowerBoundDate.getDate())}`
      : firstOfThisMonth;
  let currentPeriod = [lastOfThisMonth, afterDate];
  while (true) {
    yield currentPeriod;
    currentPeriod = getNextPeriod(currentPeriod, lowerBoundDate);
    if (!currentPeriod.length) {
      debug(`We reached the stop date, we are done!`);
      return;
    }
  }
}

async function* pageGenerator(period, cb) {
  let hasMoreToFetch = true;
  let page = 1;
  while (hasMoreToFetch) {
    debug(`Getting data for period between ${period[1]} and ${period[0]}`);
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
  const DELAY_FETCHING_MS = parseInt(process.env.GITHUB_DELAY_MS, 10) || DEFAULT_DELAY_MS;

  const [before, after] = commitsPeriod;

  debug(`Getting commits page ${page} between ${after} and ${before}`);
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const items = await fetcher.searchCommits({
          q: `author:${githubUsername}+author-date:${after}..${before}`,
          sort: 'committer-date',
          page,
        });

        return resolve(items);
      } catch (error) {
        debug('Error fetching commits', error);
        return resolve([]);
      }
    }, DELAY_FETCHING_MS);
  });
}

async function getIssuePage(issuesPeriod, page) {
  const {
    GITHUB_USERNAME: githubUsername,
  } = process.env;
  const DELAY_FETCHING_MS = parseInt(process.env.GITHUB_DELAY_MS, 10) || DEFAULT_DELAY_MS;

  const [before, after] = issuesPeriod;

  debug(`Getting issues page ${page} between ${after} and ${before}`);
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const items = await fetcher.searchIssues({
          q: `author:${githubUsername}+created:${after}..${before}`,
          sort: 'created',
          page,
        });

        return resolve(items);
      } catch (error) {
        debug('Error fetching issues', error);
        return resolve([]);
      }
    }, DELAY_FETCHING_MS);
  });
}

function processEntities(entities) {
  return entities.filter(filter).map(format);
}

function getLatestBySource(source) {
  const instance = StorageHandler.getInstance();
  return instance.getLatestBySource(source);
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
  const isFork = entity.repository && entity.repository.fork;
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
  return {
    createdAt: new Date(entity.created_at),
    description: entity.title,
    link: entity.html_url,
    type: entity.pull_request ? 'Created PR' : 'Created Issue Report',
    source: 'github-issues',
  };
}
