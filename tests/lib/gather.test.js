import test from 'ava';
import mockedEnv from 'mocked-env';
import cron from 'node-cron';
import sinon from 'sinon';

import discourse from '../../lib/discourse';
import gather from '../../lib/gather';
import github from '../../lib/github';
import reps from '../../lib/reps';
import wiki from '../../lib/wiki';

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.sandbox.stub(cron, 'schedule');
  t.context.sandbox.stub(reps, 'processActivities');
  t.context.sandbox.stub(github, 'gather');
  t.context.sandbox.stub(discourse, 'gather');
  t.context.sandbox.stub(wiki, 'gather');
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
});

test.serial('FETCH - should register cronjob', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
  });

  await gather.start();

  t.true(cron.schedule.called);

  restore();
});

test.serial('FETCH - should start gathering', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
  });

  await gather.start();

  t.true(reps.processActivities.called);
  t.true(github.gather.called);
  t.true(discourse.gather.called);
  t.true(wiki.gather.called);

  restore();
});

test.serial('no FETCH - should not register cronjob', async (t) => {
  const restore = mockedEnv({
    FETCH: undefined,
  });

  await gather.start();

  t.false(cron.schedule.called);

  restore();
});
