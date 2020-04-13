'use strict';

const debug = require('debug')('mozilla-contributions:fetcher');
const { Octokit } = require('@octokit/rest');

const GITHUB_RESULTS_PER_PAGE = 100;
let octokit;

module.exports = {
  GITHUB_RESULTS_PER_PAGE,
  init,
  searchCommits,
  searchIssues,
};

function init({ githubToken }) {
  if (githubToken) {
    debug('Initializing Octokit');
    octokit = new Octokit({
      auth: githubToken,
    });
  }
}

async function searchCommits(options) {
  const octokitOptions = {
    ...options,
    per_page: GITHUB_RESULTS_PER_PAGE, // eslint-disable-line camelcase
  };
  const response = await octokit.search.commits(octokitOptions);
  return response.data.items;
}

async function searchIssues(options) {
  const octokitOptions = {
    ...options,
    per_page: GITHUB_RESULTS_PER_PAGE, // eslint-disable-line camelcase
  };
  const response = await octokit.search.issuesAndPullRequests(octokitOptions);
  return response.data.items;
}
