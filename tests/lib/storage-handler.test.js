/* eslint camelcase: 0 */

import test from 'ava';
import mockedEnv from 'mocked-env';
import sinon from 'sinon';
import mysql from 'mysql';

import StorageHandler from '../../lib/storage-handler';

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.mysqlConnection = {
    connect: t.context.sandbox.stub().callsFake((cb) => cb()),
    on: t.context.sandbox.stub().callsFake((event, cb) => cb(new Error('OH NO!'))),
    query: t.context.sandbox.stub().callsFake((query, entryOrCB, cb) => typeof entryOrCB === 'function' ? entryOrCB() : cb()),
  };
  t.context.storageInstance = StorageHandler.getInstance();
  t.context.sandbox.stub(mysql, 'createConnection').returns(t.context.mysqlConnection);
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
});

test.serial('should create instance', (t) => {
  t.truthy(t.context.storageInstance);
});

test.serial('should return same instance if called again', (t) => {
  const instance = StorageHandler.getInstance();
  t.is(instance, t.context.storageInstance);
});

test.serial('should throw if no connect string', (t) => {
  const error = t.throws(() => t.context.storageInstance.connect());
  t.is(error.message, 'NO_CONNECT_ENV_VARIABLE');
});

test.serial('should connect and create tables', async (t) => {
  const connectString = 'mysql://foo';
  const restore = mockedEnv({
    CONNECT: connectString,
  });

  await t.context.storageInstance.connect();
  t.true(mysql.createConnection.calledWith(connectString));
  t.true(t.context.mysqlConnection.connect.calledOnce);
  t.true(t.context.mysqlConnection.on.calledOnce);
  t.true(t.context.mysqlConnection.query.calledOnce);

  restore();
});

test.serial('should not re-establish connection if done before by previous test', async (t) => {
  await t.context.storageInstance.connect();
  t.false(mysql.createConnection.called);
});

test.serial('should not throw when saving contributions', (t) => {
  const contributions = [{
    createdAt: new Date(),
    description: 'foo',
    type: 'did something',
    link: 'http://example.com',
    source: 'reps',
  }, {
    createdAt: new Date(),
    description: 'foo2',
    type: 'did something great',
    link: 'http://example.com/evenbetter',
    source: 'reps',
  }];
  t.notThrows(() => t.context.storageInstance.saveContributions(contributions));
});

test.serial('should not throw when getting contributions', (t) => {
  t.notThrows(() => t.context.storageInstance.getContributions());
});

test.serial('should not throw when deleting contributions by source', (t) => {
  t.notThrows(() => t.context.storageInstance.deleteBySource('reps'));
});
