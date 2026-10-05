import { test, expect } from 'bun:test';
import { createLatestWriteQueue } from '../../src/services/latestWriteQueue.ts';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
test('rapid changes run serially, coalesce waiting choices and suppress old replies', async () => {
  const writes = [], responses = [], first = deferred(), second = deferred();
  const queue = createLatestWriteQueue(value => {
    writes.push(value);
    return writes.length === 1 ? first.promise : second.promise;
  }, (...reply) => responses.push(reply));
  queue.enqueue(false);
  queue.enqueue(true);
  queue.enqueue(false);
  queue.enqueue(true);
  expect(writes).toEqual([false]);
  first.resolve('old acknowledgement');
  await tick();
  expect(writes).toEqual([false, true]);
  expect(responses).toEqual([]);
  second.resolve('latest acknowledgement');
  await tick();
  expect(responses).toEqual([[true, 'latest acknowledgement', undefined]]);
  queue.dispose();
});
test('an old failure does not cancel a newer requested state', async () => {
  const first = deferred(), replies = [], writes = [];
  const queue = createLatestWriteQueue(value => {
    writes.push(value);
    return writes.length === 1 ? first.promise : Promise.resolve('saved');
  }, (...reply) => replies.push(reply));
  queue.enqueue(false);
  queue.enqueue(true);
  first.reject(new Error('old failure'));
  await tick();
  expect(writes).toEqual([false, true]);
  expect(replies).toEqual([[true, 'saved', undefined]]);
  queue.dispose();
});
test('changing games drops queued writes and ignores replies from the old game', async () => {
  const first = deferred(), writes = [], replies = [];
  const queue = createLatestWriteQueue(value => { writes.push(value); return first.promise; }, (...reply) => replies.push(reply));
  queue.enqueue(false);
  queue.enqueue(true);
  queue.dispose();
  first.resolve('old game');
  await tick();
  expect(writes).toEqual([false]);
  expect(replies).toEqual([]);
});
test('a current failure is reported, then a later attempt can succeed', async () => {
  const error = new Error('write denied'), replies = [];
  let failed = false;
  const queue = createLatestWriteQueue(async () => { if (!failed) { failed = true; throw error; } return 'saved'; }, (...reply) => replies.push(reply));
  queue.enqueue(false);
  await tick();
  expect(replies[0]).toEqual([false, undefined, error]);
  queue.enqueue(true);
  await tick();
  expect(replies[1]).toEqual([true, 'saved', undefined]);
  queue.dispose();
});
