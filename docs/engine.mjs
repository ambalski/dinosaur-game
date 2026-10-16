export const SAVE_KEY = 'dino-count-v1';
export const ROUND_SIZE = 5;
export const SPECIES = [
  { name: 'Диплодок', color: '#76ac85', dark: '#477b59', light: '#cfe4bd' },
  { name: 'Трицератопс', color: '#e5b360', dark: '#9d703e', light: '#fae2a9' },
  { name: 'Стегозавр', color: '#86a9c0', dark: '#577e9a', light: '#cee3e7' },
  { name: 'Тираннозавр', color: '#d9937d', dark: '#a45f50', light: '#f5ccaf' },
  { name: 'Паразауролоф', color: '#a69ac7', dark: '#766a9a', light: '#e0d6eb' },
  { name: 'Анкилозавр', color: '#a5b66e', dark: '#71864b', light: '#e1e5b7' },
];
const MODES = ['mixed', 'count', 'add', 'subtract'];
const TYPES = ['count', 'add', 'subtract'];
const randomInt = (min, max, random) => min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
const emptyStats = () => Object.fromEntries(TYPES.map(type => [type, { solved: 0, firstTry: 0 }]));

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i, random);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function makeChoices(answer, max, random = Math.random) {
  const candidates = [];
  // Nearby alternatives make the child distinguish the actual quantity.
  for (let distance = 1; candidates.length < 3; distance++) {
    for (const value of shuffle([answer - distance, answer + distance], random)) {
      if (value >= 0 && value <= max && candidates.length < 3) candidates.push(value);
    }
  }
  return shuffle([answer, ...candidates], random);
}

export function makeQuestion(settings, serial, previous = null, random = Math.random) {
  const max = settings.max === 5 ? 5 : 10;
  // A cycle guarantees all three skills occur in each five-question mixed round.
  const type = settings.mode === 'mixed' ? TYPES[serial % TYPES.length] : settings.mode;
  let question;
  for (let attempt = 0; attempt < 12; attempt++) {
    let a, b = 0, answer;
    if (type === 'count') {
      a = randomInt(1, max, random);
      answer = a;
    } else if (type === 'add') {
      a = randomInt(1, max - 1, random);
      b = randomInt(1, max - a, random);
      answer = a + b;
    } else {
      a = randomInt(1, max, random);
      b = randomInt(1, a, random);
      answer = a - b;
    }
    question = { type, a, b, answer, max, choices: makeChoices(answer, max, random) };
    if (!previous || question.type !== previous.type || question.a !== previous.a || question.b !== previous.b) break;
  }
  return question;
}

export function createState(random = Math.random) {
  const settings = { max: 10, mode: 'mixed', sound: false };
  return {
    version: 1, settings, total: 0, counts: Array(SPECIES.length).fill(0), stats: emptyStats(),
    serial: 0, round: 0, firstTry: 0, phase: 'question', attempts: 0,
    question: makeQuestion(settings, 0, null, random), lastSpecies: null,
  };
}

export function submitAnswer(state, value) {
  if (state.phase !== 'question' || !state.question.choices.includes(value)) return { status: 'ignored' };
  state.attempts++;
  if (value !== state.question.answer) return { status: 'incorrect' };
  const species = state.total % SPECIES.length;
  state.counts[species]++;
  state.total++;
  state.round++;
  state.stats[state.question.type].solved++;
  if (state.attempts === 1) {
    state.firstTry++;
    state.stats[state.question.type].firstTry++;
  }
  state.lastSpecies = species;
  state.phase = 'hatched';
  return { status: 'correct', species };
}

export function advance(state, random = Math.random) {
  if (state.phase !== 'hatched') return false;
  if (state.round === ROUND_SIZE) {
    state.phase = 'complete';
    return true;
  }
  nextQuestion(state, random);
  return true;
}

function nextQuestion(state, random) {
  state.serial++;
  state.question = makeQuestion(state.settings, state.serial, state.question, random);
  state.phase = 'question';
  state.attempts = 0;
  state.lastSpecies = null;
}

export function startRound(state, random = Math.random) {
  state.round = 0;
  state.firstTry = 0;
  nextQuestion(state, random);
}

export function changeSettings(state, settings, random = Math.random) {
  const next = {
    max: settings.max === 5 ? 5 : 10,
    mode: MODES.includes(settings.mode) ? settings.mode : 'mixed',
    sound: Boolean(settings.sound),
  };
  const changed = next.max !== state.settings.max || next.mode !== state.settings.mode;
  state.settings = next;
  if (changed) startRound(state, random);
  return changed;
}

const isCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000000;

export function restoreState(raw, random = Math.random) {
  const fallback = () => createState(random);
  try {
    const state = JSON.parse(raw);
    if (!state || state.version !== 1 || !MODES.includes(state.settings?.mode) || ![5, 10].includes(state.settings?.max)) return fallback();
    if (!Array.isArray(state.counts) || state.counts.length !== SPECIES.length || !state.counts.every(isCount)) return fallback();
    if (!isCount(state.total) || state.total !== state.counts.reduce((a, b) => a + b, 0)) return fallback();
    if (!isCount(state.serial) || !isCount(state.round) || state.round > ROUND_SIZE || !isCount(state.firstTry) || state.firstTry > state.round || !isCount(state.attempts)) return fallback();
    if (!['question', 'hatched', 'complete'].includes(state.phase)) return fallback();
    if ((state.phase === 'complete' && state.round !== ROUND_SIZE) || (state.phase === 'question' && state.round === ROUND_SIZE)) return fallback();
    if (state.phase === 'hatched' && (!isCount(state.lastSpecies) || state.lastSpecies >= SPECIES.length || !state.round || !state.total || !state.attempts)) return fallback();
    if (!TYPES.every(type => isCount(state.stats?.[type]?.solved) && isCount(state.stats[type].firstTry) && state.stats[type].firstTry <= state.stats[type].solved)) return fallback();
    const q = state.question;
    if (!q || !TYPES.includes(q.type) || q.max !== state.settings.max || !isCount(q.a) || !isCount(q.b) || !isCount(q.answer)) return fallback();
    if (q.a < 1 || q.a > q.max || q.b > q.max || q.answer > q.max) return fallback();
    if ((q.type === 'count' && (q.b !== 0 || q.answer !== q.a)) || (q.type === 'add' && (q.b < 1 || q.answer !== q.a + q.b)) || (q.type === 'subtract' && (q.b < 1 || q.answer !== q.a - q.b))) return fallback();
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || new Set(q.choices).size !== 4 || !q.choices.includes(q.answer) || !q.choices.every(n => isCount(n) && n <= q.max)) return fallback();
    state.settings.sound = Boolean(state.settings.sound);
    return state;
  } catch { return fallback(); }
}

export function equation(question) {
  const { type, a, b, answer } = question;
  return type === 'count' ? `Всего ${answer}` : `${a} ${type === 'add' ? '+' : '−'} ${b} = ${answer}`;
}

export function explanation(question) {
  const { type, a, b, answer } = question;
  if (type === 'count') return `Посчитали все листочки. Всего ${answer}.`;
  if (type === 'add') return `Было ${a}. Добавили ${b}. Стало ${answer}.`;
  return `Было ${a}. Убрали ${b}. ${answer === 0 ? 'Ничего не осталось. Это ноль!' : `Осталось ${answer}.`}`;
}
