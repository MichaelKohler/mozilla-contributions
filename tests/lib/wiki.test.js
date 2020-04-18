/* eslint camelcase: 0 */

import test from 'ava';
import axios from 'axios';
import mockedEnv from 'mocked-env';
import sinon from 'sinon';

import wiki from '../../lib/wiki';
import storageHandler from '../../lib/storage-handler';

const dateNow = new Date();
const monthAgo = new Date(dateNow.getFullYear(), dateNow.getMonth() - 1, dateNow.getDate());
const WIKI_EDITS_STRING = `
<rss version="2.0">
  <channel>
    <title>MozillaWiki</title>
    <link>https://wiki.mozilla.org/Special:Contributions/Michaelkohler</link>
    <description>User contributions</description>
    <generator>MediaWiki 1.27.4</generator>
    <language>en</language>
    <lastBuildDate>Sat, 18 Apr 2020 12:11:24 GMT</lastBuildDate>
    <item>
      <title>Foo</title>
      <link>https://wiki.mozilla.org/index.php?title=Foo&amp;diff=455392</link>
      <guid isPermaLink="false">https://wiki.mozilla.org/index.php?title=Foo&amp;diff=455392</guid>
      <description>FooBarBaz</description>
      <pubDate>${dateNow.toISOString()}</pubDate>
      <dc:creator>Michaelkohler</dc:creator>
      <comments>https://wiki.mozilla.org/Talk:Contributors/Foo</comments>
    </item>
    <item>
      <title>Foo2</title>
      <link>https://wiki.mozilla.org/index.php?title=Foo2&amp;diff=455392</link>
      <guid isPermaLink="false">https://wiki.mozilla.org/index.php?title=Foo2&amp;diff=455392</guid>
      <description>FooBarBaz2</description>
      <pubDate>${dateNow.toISOString()}</pubDate>
      <dc:creator>Michaelkohler</dc:creator>
      <comments>https://wiki.mozilla.org/Talk:Contributors/Foo2</comments>
    </item>
    <item>
      <title>Foo</title>
      <link>https://wiki.mozilla.org/index.php?title=Foo&amp;diff=455392</link>
      <guid isPermaLink="false">https://wiki.mozilla.org/index.php?title=Foo&amp;diff=455392</guid>
      <description>FooBarBaz</description>
      <pubDate>${monthAgo.toISOString()}</pubDate>
      <dc:creator>Michaelkohler</dc:creator>
      <comments>https://wiki.mozilla.org/Talk:Contributors/Foo</comments>
    </item>
  </channel>
</rss>
`;

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  t.context.storageInstance = {
    getLatestBySource: t.context.sandbox.stub().resolves([]),
    saveContributions: t.context.sandbox.stub(),
  };
  t.context.sandbox.stub(storageHandler, 'getInstance').returns(t.context.storageInstance);
  t.context.sandbox.stub(axios, 'get').resolves({ data: WIKI_EDITS_STRING });

  const endDate = new Date();
  t.context.restoreEnv = mockedEnv({
    WIKI_USERNAME: 'michaelkohler',
    WIKI_STOP_DATE: `${endDate.getFullYear()}-${endDate.getMonth() + 1}-${endDate.getDate()}`,
  });
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
  t.context.restoreEnv();
});

test.serial('should abort without username', async (t) => {
  t.context.restoreEnv = mockedEnv({
    WIKI_USERNAME: undefined,
  });

  await wiki.gather();

  t.false(axios.get.called);
});

test.serial('should fetch', async (t) => {
  await wiki.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 2);
});

test.serial('should format', async (t) => {
  await wiki.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.deepEqual(contributions[0], {
    createdAt: dateNow,
    description: `Edited Foo`,
    link: 'https://wiki.mozilla.org/index.php?title=Foo&diff=455392',
    type: 'Wiki Edit',
    source: 'wiki',
  });
});

test.serial('should respect lower bound', async (t) => {
  t.context.storageInstance.getLatestBySource.resolves([{
    createdAt: new Date('2020-04-14'), // one day after the first page fixture
  }]);

  await wiki.gather();

  t.is(axios.get.callCount, 1);
  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 2);
});

test.serial('should return empty if no content', async (t) => {
  axios.get.resolves({ data: '' });

  await wiki.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 0);
});

test.serial('should return empty if channel', async (t) => {
  axios.get.resolves({ data: '<rss version="2.0"></rss>' });

  await wiki.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 0);
});

test.serial('should return empty if empty channel', async (t) => {
  axios.get.resolves({ data: '<rss version="2.0"><channel></channel></rss>' });

  await wiki.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 0);
});

test.serial('should return empty if fail to parse', async (t) => {
  axios.get.resolves({ data: '<rss version="""""""2.0"><channel></channel></rss>' });

  await wiki.gather();

  const [contributions] = t.context.storageInstance.saveContributions.getCall(0).args;
  t.is(contributions.length, 0);
});
