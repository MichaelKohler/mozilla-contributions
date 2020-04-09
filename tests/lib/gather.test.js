import test from 'ava';
import mockedEnv from 'mocked-env';
import cron from 'node-cron';
import sinon from 'sinon';

import gather from '../../lib/gather';
import reps from '../../lib/reps';

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.sandbox.stub(cron, 'schedule');
  t.context.sandbox.stub(reps, 'processActivities');
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

test.serial('no FETCH - should not register cronjob', async (t) => {
  const restore = mockedEnv({
    FETCH: undefined,
  });

  await gather.start();

  t.false(cron.schedule.called);

  restore();
});
