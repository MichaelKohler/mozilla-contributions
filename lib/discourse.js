'use strict';

const debug = require('debug')('mozilla-contributions:discourse');
const axios = require('axios');

const StorageHandler = require('./storage-handler');

const BASE_URL = 'https://discourse.mozilla.org';
const RESULTS_PER_PAGE = 30;

module.exports = {
  gather,
};

async function gather() {
  const { DISCOURSE_USERNAME: discourseUsername } = process.env;

  if (!discourseUsername) {
    debug('No Discourse username passed');
    return [];
  }

  const topics = await processTopics();
  const posts = await processPosts();
  const contributions = [
    ...topics,
    ...posts,
  ];

  await save(contributions);

  debug('Finished saving contributions');
  return contributions;
}

async function processTopics() {
  debug('Getting topics from Discourse');
  let allTopics = [];

  const latestSavedTopic = await getLatestBySource('discourse-topics');
  const lowerBoundDate = latestSavedTopic[0] && new Date(latestSavedTopic[0].createdAt);
  const page = topicPageGenerator();

  for await (const topicsResponse of page) {
    const { topics } = topicsResponse.topic_list;
    debug(`Got ${topics.length} topics`);
    allTopics = allTopics.concat(topics.map(format));

    const lastTopicDate = topics[topics.length - 1].created_at;
    const hasHitLowerBound = lowerBoundDate ? lastTopicDate < lowerBoundDate : false;
    const hasMore = topics.length === RESULTS_PER_PAGE;
    if (hasHitLowerBound || !hasMore) {
      debug('We are done!');
      return allTopics;
    }
  }
}

async function processPosts() {
  debug('Getting posts from Discourse');
  let allPosts = [];

  const latestSavedPost = await getLatestBySource('discourse-posts');
  const lowerBoundDate = latestSavedPost[0] && new Date(latestSavedPost[0].createdAt);
  const page = postPageGenerator();

  for await (const postsResponse of page) {
    const posts = postsResponse.user_actions;
    debug(`Got ${posts.length} posts`);
    allPosts = allPosts.concat(posts.map(format));

    const lastTopicDate = posts[posts.length - 1].created_at;
    const hasHitLowerBound = lowerBoundDate ? lastTopicDate < lowerBoundDate : false;
    const hasMore = posts.length === RESULTS_PER_PAGE;
    if (hasHitLowerBound || !hasMore) {
      debug('We are done!');
      return allPosts;
    }
  }
}

async function* topicPageGenerator() {
  const { DISCOURSE_USERNAME: discourseUsername } = process.env;
  let page = 0;
  while (true) {
    debug(`Getting page ${page}`);
    const url = `${BASE_URL}/topics/created-by/${discourseUsername}.json?page=${page}`;
    const results = await getDiscourseData(url);
    page++;
    yield results;
  }
}

async function* postPageGenerator() {
  const { DISCOURSE_USERNAME: discourseUsername } = process.env;
  let page = 0;
  while (true) {
    debug(`Getting page ${page}`);
    const offset = page * RESULTS_PER_PAGE;
    const url = `${BASE_URL}/user_actions.json?username=${discourseUsername}&filter=5&offset=${offset}`;
    const results = await getDiscourseData(url);
    page++;
    yield results;
  }
}

async function getDiscourseData(url) {
  const response = await axios.get(url);
  return response.data;
}

function format(entity) {
  if (entity.post_id) {
    return formatPost(entity);
  }

  return formatTopic(entity);
}

function formatTopic(entity) {
  return {
    createdAt: new Date(entity.created_at),
    description: entity.title,
    link: `${BASE_URL}/t/${entity.slug}/${entity.id}`,
    type: 'Created Discourse Topic',
    source: 'discourse-topics',
  };
}

function formatPost(entity) {
  return {
    createdAt: new Date(entity.created_at),
    description: entity.title,
    link: `${BASE_URL}/t/${entity.slug}/${entity.topic_id}/${entity.post_number}`,
    type: 'Posted on Discourse Topic',
    source: 'discourse-posts',
  };
}

function getLatestBySource(source) {
  const instance = StorageHandler.getInstance();
  return instance.getLatestBySource(source);
}

function save(contributions) {
  const instance = StorageHandler.getInstance();
  return instance.saveContributions(contributions);
}
