/* eslint camelcase: 0 */

import test from 'ava';
import axios from 'axios';
import mockedEnv from 'mocked-env';
import sinon from 'sinon';

import discourse from '../../lib/discourse';
import storageHandler from '../../lib/storage-handler';

const TOPICS = {
  topic_list: {
    topics: new Array(30).fill(0).map((_, index) => ({ // eslint-disable-line newline-per-chained-call
      created_at: new Date('2020-04-13'),
      title: `Topic ${index}`,
      slug: `slug-${index}`,
      id: index,
    })),
  },
};

const TOPICS_SMALL = {
  topic_list: {
    topics: [{
      created_at: new Date('2020-04-13'),
      title: `Topic 1`,
      slug: `slug-1`,
      id: 1,
    }],
  },
};

const POSTS = {
  user_actions: new Array(30).fill(0).map((_, index) => ({ // eslint-disable-line newline-per-chained-call
    created_at: new Date('2020-04-13'),
    title: `Post ${index}`,
    slug: `slug-${index}`,
    topic_id: index,
    post_id: 1,
    post_number: 1,
  })),
};

const POSTS_SMALL = {
  user_actions: [{
    created_at: new Date('2020-04-13'),
    title: `Post 1`,
    slug: `slug-1`,
    topic_id: 1,
    post_id: 1,
    post_number: 1,
  }],
};

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.storageInstance = {
    getLatestBySource: t.context.sandbox.stub().resolves([]),
    saveContributions: t.context.sandbox.stub(),
  };
  t.context.sandbox.stub(storageHandler, 'getInstance').returns(t.context.storageInstance);

  t.context.sandbox.stub(axios, 'get').onCall(0)
    .resolves({ data: TOPICS });
  axios.get.onCall(1)
    .resolves({ data: TOPICS_SMALL });
  axios.get.onCall(2)
    .resolves({ data: POSTS });
  axios.get.onCall(3)
    .resolves({ data: POSTS_SMALL });

  t.context.restoreEnv = mockedEnv({
    DISCOURSE_USERNAME: 'mkohler',
  });
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
  t.context.restoreEnv();
});

test.serial('should abort without username', async (t) => {
  t.context.restoreEnv = mockedEnv({
    DISCOURSE_USERNAME: undefined,
  });

  await discourse.gather();

  t.false(axios.get.called);
});

test.serial('should fetch', async (t) => {
  await discourse.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 30 + 1 + 30 + 1);
});

test.serial('should format', async (t) => {
  await discourse.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  // Topic
  t.deepEqual(contributions[0], {
    createdAt: new Date('2020-04-13'),
    description: `Topic 0`,
    link: 'https://discourse.mozilla.org/t/slug-0/0',
    type: 'Created Discourse Topic',
    source: 'discourse-topics',
  });
  // Post
  t.deepEqual(contributions[31], {
    createdAt: new Date('2020-04-13'),
    description: `Post 0`,
    link: 'https://discourse.mozilla.org/t/slug-0/0/1',
    type: 'Posted on Discourse Topic',
    source: 'discourse-posts',
  });
});

test.serial('should respect lower bound', async (t) => {
  t.context.storageInstance.getLatestBySource.resolves([{
    createdAt: new Date('2020-04-14'), // one day after the first page fixture
  }]);

  axios.get.onCall(0)
    .resolves({ data: TOPICS });
  axios.get.onCall(1)
    .resolves({ data: POSTS });

  await discourse.gather();

  t.is(axios.get.callCount, 2);
  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 30 + 30);
});
