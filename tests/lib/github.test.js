/* eslint camelcase: 0 */

import test from 'ava';
import mockedEnv from 'mocked-env';
import sinon from 'sinon';

import fetcher from '../../lib/fetcher';
import github from '../../lib/github';
import storageHandler from '../../lib/storage-handler';

const API_COMMITS = new Array(100).fill(0)
  .map((_, index) => ({
    html_url: `https://github.com/MichaelKohler/mozilla/commits/${index}`,
    commit: {
      author: {
        date: new Date('2020-04-13'),
      },
      message: `Commit ${index}`,
    },
    repository: {
      name: 'mozilla',
      owner: {
        login: 'MichaelKohler',
      },
      fork: false,
    },
  }));

const API_COMMITS_SMALL = [{
  html_url: `https://github.com/MichaelKohler/mozilla/commits/1`,
  commit: {
    author: {
      date: new Date('2020-04-13'),
    },
    message: `Commit 1`,
  },
  repository: {
    name: 'mozilla',
    owner: {
      login: 'MichaelKohler',
    },
    fork: false,
  },
}];

const API_COMMITS_SMALL_MIXED = [{
  html_url: `https://github.com/MichaelKohler/foo/commits/1`,
  commit: {
    author: {
      date: new Date('2020-04-13'),
    },
    message: `Commit 1`,
  },
  repository: {
    name: 'foo',
    owner: {
      login: 'MichaelKohler',
    },
    fork: false,
  },
}, {
  html_url: `https://github.com/MichaelKohler/foo/commits/1`,
  commit: {
    author: {
      date: new Date('2020-04-13'),
    },
    message: `Commit 1`,
  },
  repository: {
    name: 'foo',
    owner: {
      login: 'MichaelKohler',
    },
    fork: true,
  },
}, {
  html_url: `https://github.com/MichaelKohler/mozilla/commits/1`,
  commit: {
    author: {
      date: new Date('2020-04-13'),
    },
    message: `Commit 1`,
  },
  repository: {
    name: 'mozilla',
    owner: {
      login: 'MichaelKohler',
    },
    fork: false,
  },
}];

const API_COMMIT_SMALL_PRIVATE = [{
  html_url: `https://github.com/MichaelKohler/mozilla/commits/1`,
  commit: {
    author: {
      date: new Date('2020-04-13'),
    },
    message: `Commit 1`,
  },
  repository: {
    private: true,
    name: 'mozilla',
    owner: {
      login: 'MichaelKohler',
    },
    fork: false,
  },
}];

const API_ISSUES = new Array(100).fill(0)
  .map((_, index) => ({
    created_at: new Date('2020-04-13'),
    html_url: `https://github.com/MichaelKohler/mozilla/issues/${index}`,
    title: `Issue ${index}`,
  }));

const API_ISSUES_SMALL = [{
  created_at: new Date('2020-04-13'),
  html_url: `https://github.com/MichaelKohler/mozilla/issues/1`,
  title: `Issue 1`,
}];

const API_ISSUES_SMALL_MIXED = [{
  created_at: new Date('2020-04-13'),
  html_url: `https://github.com/MichaelKohler/mozilla/issues/1`,
  title: `Issue 1`,
}, {
  created_at: new Date('2020-04-13'),
  html_url: `https://github.com/MichaelKohler/bar/issues/1`,
  title: `Issue 1`,
}];

const API_PR_SMALL = [{
  created_at: new Date('2020-04-13'),
  html_url: `https://github.com/MichaelKohler/mozilla/issues/1`,
  title: `PR 1`,
  pull_request: {
    html_url: `https://github.com/MichaelKohler/mozilla/issues/1`,
  },
}];

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.storageInstance = {
    getLatestBySource: t.context.sandbox.stub().resolves([]),
    saveContributions: t.context.sandbox.stub(),
  };
  t.context.sandbox.stub(storageHandler, 'getInstance').returns(t.context.storageInstance);
  t.context.sandbox.stub(fetcher, 'init');

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() - 1);
  t.context.restoreEnv = mockedEnv({
    GITHUB_TOKEN: 'michaelkohler',
    GITHUB_USERNAME: 'michaelkohler',
    GITHUB_STOP_DATE: `${endDate.getFullYear()}-${endDate.getMonth() + 1}-${endDate.getDate()}`,
    GITHUB_DELAY_MS: '10',
  });

  t.context.sandbox.stub(fetcher, 'searchCommits').onCall(0)
    .resolves(API_COMMITS);
  fetcher.searchCommits.onCall(1).resolves(API_COMMITS_SMALL);
  fetcher.searchCommits.onCall(2).resolves([]);
  t.context.sandbox.stub(fetcher, 'searchIssues').onCall(0)
    .resolves(API_ISSUES);
  fetcher.searchIssues.onCall(1).resolves(API_ISSUES_SMALL);
  fetcher.searchIssues.onCall(2).resolves([]);
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
  t.context.restoreEnv();
});

test.serial('should init fetcher', async (t) => {
  await github.gather();

  t.true(fetcher.init.calledOnce);
});

test.serial('should abort if no GitHub token', async (t) => {
  const restore = mockedEnv({
    GITHUB_TOKEN: undefined,
    GITHUB_USERNAME: 'foo',
  });

  await github.gather();

  t.false(fetcher.init.calledOnce);
  restore();
});

test.serial('should abort if no GitHub username', async (t) => {
  const restore = mockedEnv({
    GITHUB_TOKEN: '123',
    GITHUB_USERNAME: undefined,
  });

  await github.gather();

  t.false(fetcher.init.calledOnce);
  restore();
});

test.serial('should fetch everything over 2 periods', async (t) => {
  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 100 + 1 + 100 + 1);
});

test.serial('should format commits correctly', async (t) => {
  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.deepEqual(contributions[101], {
    createdAt: new Date('2020-04-13'),
    description: 'MichaelKohler/mozilla: Commit 0',
    link: 'https://github.com/MichaelKohler/mozilla/commits/0',
    type: 'GitHub Commit',
    source: 'github',
  });
});

test.serial('should format issues correctly', async (t) => {
  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.deepEqual(contributions[0], {
    createdAt: new Date('2020-04-13'),
    description: 'Issue 0',
    link: 'https://github.com/MichaelKohler/mozilla/issues/0',
    type: 'Created Issue Report',
    source: 'github-issues',
  });
});

test.serial('should format PR correctly', async (t) => {
  fetcher.searchIssues.onCall(0).resolves(API_PR_SMALL);

  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  // PR
  t.deepEqual(contributions[0], {
    createdAt: new Date('2020-04-13'),
    description: 'PR 1',
    link: 'https://github.com/MichaelKohler/mozilla/issues/1',
    type: 'Created PR',
    source: 'github-issues',
  });
});

test.serial('should format private commit correctly', async (t) => {
  fetcher.searchCommits.onCall(0).resolves(API_COMMIT_SMALL_PRIVATE);

  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.deepEqual(contributions[101], {
    createdAt: new Date('2020-04-13'),
    description: 'Commit in private repository',
    link: '',
    type: 'GitHub Commit',
    source: 'github',
  });
});

test.serial('should pass correct query filters', async (t) => {
  await github.gather();

  const [options] = fetcher.searchCommits.getCall(0).args;
  t.true(options.q.includes('author:michaelkohler+author-date:'));
  t.is(options.sort, 'committer-date');
  t.is(options.page, 1);
  const [secondOptions] = fetcher.searchCommits.getCall(1).args;
  t.true(secondOptions.q.includes('author:michaelkohler+author-date:'));
  t.is(secondOptions.sort, 'committer-date');
  t.is(secondOptions.page, 2);

  const [issuesOptions] = fetcher.searchIssues.getCall(0).args;
  t.true(issuesOptions.q.includes('author:michaelkohler+created:'));
  t.is(issuesOptions.sort, 'created');
  t.is(issuesOptions.page, 1);
  const [secondIssuesOptions] = fetcher.searchIssues.getCall(1).args;
  t.true(secondIssuesOptions.q.includes('author:michaelkohler+created:'));
  t.is(secondIssuesOptions.sort, 'created');
  t.is(secondIssuesOptions.page, 2);
});

test.serial('should respect last entry date', async (t) => {
  const restore = mockedEnv({
    GITHUB_STOP_DATE: undefined,
  });
  t.context.storageInstance.getLatestBySource.resolves([{
    createdAt: new Date(),
  }]);
  fetcher.searchCommits.onCall(0).resolves(API_COMMITS_SMALL);
  fetcher.searchIssues.onCall(0).resolves(API_ISSUES_SMALL);

  await github.gather();

  t.is(fetcher.searchCommits.callCount, 1);
  t.is(fetcher.searchIssues.callCount, 1);
  restore();
});

test.serial('should handle rejections when fetching and return empty', async (t) => {
  fetcher.searchCommits.onCall(0).rejects(new Error('NO!'));
  fetcher.searchCommits.onCall(1).resolves([]);
  fetcher.searchIssues.onCall(0).rejects(new Error('NO!'));
  fetcher.searchIssues.onCall(1).resolves([]);

  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 0);
});

test.serial('should filter correctly', async (t) => {
  const restore = mockedEnv({
    GITHUB_FILTER: 'foo|bar',
  });
  fetcher.searchCommits.onCall(0).resolves(API_COMMITS_SMALL_MIXED);
  fetcher.searchIssues.onCall(0).resolves(API_ISSUES_SMALL_MIXED);

  await github.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  // Commits: one of three matches (one wrong name and one is a fork)
  // Issues: one of two matches
  t.is(contributions.length, 2);
  restore();
});
