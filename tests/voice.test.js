import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LinePicker, LINES, fill } from '../src/audio/lines.js';

test('fill replaces placeholders', () => {
  assert.equal(fill('Level {n}. {name}!', { n: 3, name: 'Pass it On' }), 'Level 3. Pass it On!');
});

test('picker never repeats the same line twice in a row', () => {
  const p = new LinePicker(() => 0); // always wants index 0
  const a = p.pick('puffWake').text;
  const b = p.pick('puffWake').text;
  assert.notEqual(a, b);
});

test('every line kind has a speaker and at least one line', () => {
  for (const [kind, set] of Object.entries(LINES)) {
    assert.ok(['narrator', 'puff'].includes(set.who), kind);
    assert.ok(set.lines.length > 0, kind);
  }
});

test('unknown kinds return null', () => {
  assert.equal(new LinePicker().pick('nope'), null);
});
