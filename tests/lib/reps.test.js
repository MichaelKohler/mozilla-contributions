/* eslint camelcase: 0 */

import test from 'ava';
import fs from 'fs';
import mockedEnv from 'mocked-env';
import sinon from 'sinon';

import reps from '../../lib/reps';

const ACTIVITIES = [
  {
    user: {
      first_name: 'Wim',
      last_name: 'Benes',
      display_name: 'fryskefirefox',
    },
    activity: 'Attended an Event',
    initiative: 'MozActivate - Common Voice',
    activity_description: 'Get together at the venue or anywhere in the world to donate your voice in Frisian.',
    report_date: '2020-10-12',
    link: 'https://reps.mozilla.org/e/fryske-common-voice/',
    link_description: '',
    event: {
      name: 'Fryske Common Voice Ynsprekwike',
    },
  },
  {
    user: {
      first_name: 'Michael',
      last_name: 'Kohler',
      display_name: 'mkohler',
    },
    activity: 'Attended an Event',
    initiative: 'MozActivate - Common Voice',
    activity_description: 'Some event!',
    report_date: '2020-10-12',
    link: 'https://reps.mozilla.org/e/common-voice/',
    link_description: '',
    event: {
      name: 'CV Event',
    },
  },
  {
    user: {
      first_name: 'Michael',
      last_name: 'Kohler',
      display_name: 'mkohler',
    },
    activity: 'Wrote an article',
    initiative: 'MozActivate - Common Voice',
    activity_description: 'I wrote something!!',
    report_date: '2020-10-12',
    link: 'https://example.com/article',
    link_description: '',
  },
  {
    user: {
      first_name: 'Michael',
      last_name: 'Kohler',
      display_name: 'mkohler',
    },
    activity: 'Completed post event metrics',
    initiative: 'MozActivate - Common Voice',
    activity_description: '',
    report_date: '2020-10-12',
    link: 'https://reps.mozilla.org/e/common-voice/',
    link_description: '',
    event: {
      name: 'CV Event',
    },
  },
];
const ACTIVITIES_STRING = JSON.stringify(ACTIVITIES);

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.sandbox.stub(fs.promises, 'readFile').resolves(ACTIVITIES_STRING);
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
});

test.serial('should not do anything if no path passed', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: undefined,
  });

  await reps.processActivities();
  t.false(fs.promises.readFile.called);

  restore();
});

test.serial('should not do anything if no username passed', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'file.json',
    REPS_USERNAME: undefined,
  });

  await reps.processActivities();
  t.false(fs.promises.readFile.called);

  restore();
});

test.serial('should get activities from file filtered by user - multiple', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'some_file.json',
    REPS_USERNAME: 'mkohler',
  });

  const activities = await reps.processActivities();
  t.is(activities.length, 3);

  restore();
});

test.serial('should format activities - attended event', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'some_file.json',
    REPS_USERNAME: 'mkohler',
  });

  const activities = await reps.processActivities();
  t.deepEqual(activities[0].date, new Date('2020-10-12'));
  t.is(activities[0].type, 'Attended an Event');
  t.is(activities[0].description, 'CV Event: Some event!');
  t.is(activities[0].link, 'https://reps.mozilla.org/e/common-voice/');

  restore();
});

test.serial('should format activities - wrote article - no event info', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'some_file.json',
    REPS_USERNAME: 'mkohler',
  });

  const activities = await reps.processActivities();
  t.deepEqual(activities[1].date, new Date('2020-10-12'));
  t.is(activities[1].type, 'Wrote an article');
  t.is(activities[1].description, 'I wrote something!!');
  t.is(activities[1].link, 'https://example.com/article');

  restore();
});

test.serial('should format activities - post event metrics - no description', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'some_file.json',
    REPS_USERNAME: 'mkohler',
  });

  const activities = await reps.processActivities();
  t.deepEqual(activities[2].date, new Date('2020-10-12'));
  t.is(activities[2].type, 'Completed post event metrics');
  t.is(activities[2].description, 'CV Event');
  t.is(activities[2].link, 'https://reps.mozilla.org/e/common-voice/');

  restore();
});

test.serial('should return empty array if file could not be read', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'some_file.json',
    REPS_USERNAME: 'foo',
  });

  fs.promises.readFile.rejects(new Error('NOPE!'));
  const activities = await reps.processActivities('some_path.json');
  t.is(activities.length, 0);

  restore();
});

test.serial('should return empty array if file content can not be parsed', async (t) => {
  const restore = mockedEnv({
    FETCH: 'true',
    REPS_ACTIVITY_PATH: 'some_file.json',
    REPS_USERNAME: 'foo',
  });

  t.context.sandbox.stub(JSON, 'parse').throws(new Error('OH NO!'));
  const activities = await reps.processActivities('some_path.json');
  t.is(activities.length, 0);

  restore();
});
