import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, makeQuestion, makeChoices, submitAnswer, advance, startRound, restoreState, changeSettings, ROUND_SIZE, SPECIES } from '../docs/engine.mjs';

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('20,000 generated tasks have valid arithmetic and four distinct choices', () => {
  const random = seeded(42137);
  for (const max of [5, 10]) for (const mode of ['mixed', 'count', 'add', 'subtract']) {
    for (let i = 0; i < 2500; i++) {
      const q = makeQuestion({ max, mode }, i, null, random);
      assert.ok(q.a >= 1 && q.a <= max);
      assert.ok(q.answer >= 0 && q.answer <= max);
      assert.equal(q.answer, q.type === 'count' ? q.a : q.type === 'add' ? q.a + q.b : q.a - q.b);
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4);
      assert.ok(q.choices.includes(q.answer));
      assert.ok(q.choices.every(n => Number.isInteger(n) && n >= 0 && n <= max));
    }
  }
});

test('choices cover zero and both range boundaries without duplicates', () => {
  for (const max of [5, 10]) for (let answer = 0; answer <= max; answer++) {
    for (const random of [() => 0, () => 0.99999]) {
      const choices = makeChoices(answer, max, random);
      assert.equal(new Set(choices).size, 4);
      assert.ok(choices.includes(answer));
      assert.ok(choices.every(n => n >= 0 && n <= max));
    }
  }
});

test('every five-task mixed round contains counting, addition and subtraction', () => {
  for (let start = 0; start < 30; start++) {
    const types = Array.from({ length: ROUND_SIZE }, (_, i) => makeQuestion({ max: 10, mode: 'mixed' }, start + i).type);
    assert.equal(new Set(types).size, 3);
  }
});

test('an incorrect answer preserves task and collection; retry hatches exactly once', () => {
  const state = createState();
  const task = state.question;
  const wrong = task.choices.find(n => n !== task.answer);
  assert.equal(submitAnswer(state, wrong).status, 'incorrect');
  assert.equal(state.total, 0);
  assert.equal(state.round, 0);
  assert.equal(state.question, task);
  assert.equal(advance(state), false);
  assert.equal(submitAnswer(state, task.answer).status, 'correct');
  assert.equal(state.total, 1);
  assert.equal(state.firstTry, 0);
  assert.equal(submitAnswer(state, task.answer).status, 'ignored');
  assert.equal(state.total, 1);
  assert.equal(state.stats[task.type].solved, 1);
  assert.equal(state.stats[task.type].firstTry, 0);
});

test('off-list and nonnumeric answers cannot grant rewards', () => {
  const state = createState();
  for (const invalid of [-1, 11, '3', NaN, Infinity, null]) assert.equal(submitAnswer(state, invalid).status, 'ignored');
  assert.equal(state.attempts, 0);
  assert.equal(state.total, 0);
});

test('a full round rewards five dinosaurs, pauses and starts another without losing progress', () => {
  const state = createState();
  for (let i = 0; i < 5; i++) {
    submitAnswer(state, state.question.answer);
    assert.equal(state.total, i + 1);
    assert.equal(state.phase, 'hatched');
    advance(state);
  }
  assert.equal(state.phase, 'complete');
  assert.equal(state.firstTry, 5);
  assert.equal(advance(state), false);
  startRound(state);
  assert.equal(state.round, 0);
  assert.equal(state.total, 5);
  submitAnswer(state, state.question.answer);
  assert.deepEqual(state.counts, Array(SPECIES.length).fill(1));
});

test('reload preserves a hatched task and cannot award it a second time', () => {
  const state = createState();
  submitAnswer(state, state.question.answer);
  const restored = restoreState(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.equal(submitAnswer(restored, restored.question.answer).status, 'ignored');
  assert.equal(restored.total, 1);
  advance(restored);
  assert.equal(restored.phase, 'question');
});

test('save round trips at every phase over 100 answers', () => {
  let state = createState();
  for (let i = 0; i < 100; i++) {
    const before = structuredClone(state);
    state = restoreState(JSON.stringify(state));
    assert.deepEqual(state, before);
    submitAnswer(state, state.question.answer);
    assert.deepEqual(restoreState(JSON.stringify(state)), state);
    advance(state);
    assert.deepEqual(restoreState(JSON.stringify(state)), state);
    if (state.phase === 'complete') startRound(state);
  }
  assert.equal(state.total, 100);
  assert.equal(state.counts.reduce((a, b) => a + b), 100);
});

test('settings change starts a fresh series and preserves the collection', () => {
  const state = createState();
  submitAnswer(state, state.question.answer);
  assert.equal(changeSettings(state, { max: 5, mode: 'subtract', sound: true }), true);
  assert.equal(state.total, 1);
  assert.equal(state.round, 0);
  assert.equal(state.question.type, 'subtract');
  assert.ok(state.question.a <= 5);
  assert.equal(changeSettings(state, { ...state.settings, sound: false }), false);
  assert.equal(state.settings.sound, false);
});

test('bad or incompatible saves recover without a crash', () => {
  for (const raw of [null, '', 'no json', 'null', '[]', '{}', '{"version":9}', '"<script>"']) {
    assert.equal(restoreState(raw).phase, 'question');
    assert.equal(restoreState(raw).total, 0);
  }
  for (const corrupt of [
    s => s.counts[0] = -1,
    s => s.total = 3,
    s => s.question.answer = 20,
    s => s.question.choices = [1, 1, 1, 1],
    s => s.settings.mode = '<script>',
    s => s.phase = 'complete',
    s => s.stats.add.solved = 'abc',
  ]) {
    const state = createState();
    corrupt(state);
    const recovered = restoreState(JSON.stringify(state));
    assert.equal(recovered.total, 0);
    assert.equal(recovered.phase, 'question');
    assert.equal(recovered.settings.mode, 'mixed');
  }
});

test('subtraction includes zero and never produces negative numbers', () => {
  const random = seeded(32);
  const answers = new Set();
  for (let i = 0; i < 1000; i++) {
    const q = makeQuestion({ max: 10, mode: 'subtract' }, i, null, random);
    answers.add(q.answer);
    assert.ok(q.b >= 1 && q.b <= q.a);
  }
  assert.ok(answers.has(0));
  assert.ok(answers.has(9));
});
