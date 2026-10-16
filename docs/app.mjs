import { SAVE_KEY, ROUND_SIZE, SPECIES, createState, restoreState, submitAnswer, advance, startRound, changeSettings, equation, explanation } from './engine.mjs';
import { icons, eggSVG, dinoSVG } from './art.mjs';

const $ = id => document.getElementById(id);
let state;
let counted = new Map();
let audioContext;
let voiceTimer;
try { state = restoreState(localStorage.getItem(SAVE_KEY)); }
catch { state = createState(); $('storage-notice').hidden = false; }

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    $('storage-notice').hidden = true;
  } catch { $('storage-notice').hidden = false; }
}

const typeLabel = { count: 'СЧИТАЕМ', add: 'СКЛАДЫВАЕМ', subtract: 'ВЫЧИТАЕМ' };
const typeTitle = { count: 'Сколько здесь листочков?', add: 'Сколько стало листочков?', subtract: 'Сколько листочков осталось?' };

function render() {
  counted = new Map();
  $('tap-hint').textContent = 'Касайся листочков и считай по порядку';
  $('help-button').textContent = 'Давай посчитаем вместе';
  $('total-count').textContent = state.total;
  $('open-garden').setAttribute('aria-label', `Мой парк. Динозавриков: ${state.total}`);
  const complete = state.phase === 'complete';
  $('play-screen').hidden = complete;
  $('complete-screen').hidden = !complete;
  if (complete) {
    const latest = (state.total - 1) % SPECIES.length;
    $('complete-art').innerHTML = [latest + 4, latest + 5, latest].map(n => dinoSVG(n % SPECIES.length)).join('');
    return;
  }
  const q = state.question;
  const solved = state.phase === 'hatched';
  $('round-label').textContent = `Задание ${solved ? state.round : state.round + 1} из ${ROUND_SIZE}`;
  $('round-progress').setAttribute('aria-label', `Вылупилось ${state.round} из ${ROUND_SIZE} динозавриков`);
  $('round-progress').innerHTML = Array.from({ length: ROUND_SIZE }, (_, i) => `<span aria-hidden="true" class="progress-egg ${i < state.round ? 'filled' : i === state.round ? 'current' : ''}"></span>`).join('');
  $('task-label').textContent = typeLabel[q.type];
  $('question-title').textContent = typeTitle[q.type];
  $('task-story').textContent = q.type === 'count' ? 'Посчитай угощение для динозаврика.' : q.type === 'add' ? `Было ${q.a}. Добавили ещё ${q.b}.` : `Было ${q.a}. Убрали ${q.b}. Перечёркнутые не считаем.`;
  renderObjects();
  const symbol = q.type === 'add' ? '+' : '−';
  $('formula').innerHTML = q.type === 'count' ? '' : `${q.a} ${symbol} ${q.b} = <span class="unknown">${solved ? q.answer : '?'}</span>`;
  $('formula').setAttribute('aria-label', q.type === 'count' ? '' : `${q.a} ${q.type === 'add' ? 'плюс' : 'минус'} ${q.b} равно ${solved ? q.answer : 'сколько?'}`);
  $('tap-hint').hidden = solved;
  $('answers').innerHTML = q.choices.map(value => `<button type="button" class="answer" data-answer="${value}" aria-label="Ответ ${value}">${value}</button>`).join('');
  $('answer-area').hidden = solved;
  $('help-button').hidden = solved;
  $('feedback').textContent = '';
  $('solution').hidden = !solved;
  $('next-button').hidden = !solved;
  $('nest').classList.toggle('hatched', solved);
  $('nest').classList.remove('helping');
  if (solved) renderReward(false);
  else {
    $('nest-art').innerHTML = eggSVG();
    $('nest-label').textContent = 'КТО ЖЕ ТАМ ВНУТРИ?';
    $('nest-title').textContent = 'Твой новый друг';
    $('nest-description').textContent = 'Он ждёт верного ответа';
    $('nest').setAttribute('aria-label', 'Динозаврик в яйце ждёт верного ответа');
  }
}

function leaf(index, removed = false) {
  return `<button type="button" class="leaf-token${removed ? ' removed' : ''}" data-token="${index}" ${removed || state.phase !== 'question' ? 'disabled' : ''} aria-label="${removed ? 'Этот листочек убрали' : 'Посчитать листочек'}">${icons.leaf}</button>`;
}

function renderObjects() {
  const q = state.question;
  const grouped = q.type === 'add';
  $('objects').className = `objects${grouped ? ' has-groups' : ''}${q.a + q.b > 8 ? ' many' : ''}`;
  if (grouped) {
    $('objects').innerHTML = `<div class="group-wrapper"><span class="group-label">Было ${q.a}</span><div class="object-group" style="--columns:${Math.min(3, q.a)}" role="group" aria-label="Первая группа: ${q.a}">${Array.from({ length: q.a }, (_, i) => leaf(i)).join('')}</div></div><span class="group-operator" aria-hidden="true">+</span><div class="group-wrapper"><span class="group-label">Добавили ${q.b}</span><div class="object-group added" style="--columns:${Math.min(3, q.b)}" role="group" aria-label="Вторая группа: ${q.b}">${Array.from({ length: q.b }, (_, i) => leaf(q.a + i)).join('')}</div></div>`;
  } else {
    $('objects').innerHTML = `<div class="object-group">${Array.from({ length: q.a }, (_, i) => leaf(i, q.type === 'subtract' && i >= q.answer)).join('')}</div>`;
  }
  $('objects').setAttribute('aria-label', q.type === 'subtract' ? `Было ${q.a} листочков. ${q.b} перечёркнутых убрали.` : q.type === 'add' ? `Две группы листочков: ${q.a} и ${q.b}` : 'Листочки для счёта');
}

function markToken(button) {
  const index = Number(button.dataset.token);
  if (counted.has(index) || button.disabled) return;
  const number = counted.size + 1;
  counted.set(index, number);
  button.classList.add('counted');
  button.setAttribute('aria-label', `Листочек посчитан: ${number}`);
  button.setAttribute('aria-pressed', 'true');
  const label = document.createElement('span');
  label.className = 'token-number';
  label.textContent = number;
  label.setAttribute('aria-hidden', 'true');
  button.append(label);
  $('tap-hint').textContent = `Посчитали: ${number}. ${number === state.question.answer ? 'Теперь выбери число.' : 'Коснись следующего листочка.'}`;
}

function renderReward(announce = true) {
  const species = state.lastSpecies;
  $('nest').classList.add('hatched');
  $('nest').classList.remove('helping');
  $('nest-art').innerHTML = dinoSVG(species);
  $('nest-label').textContent = 'ПРИВЕТ, МАЛЫШ!';
  $('nest-title').textContent = SPECIES[species].name;
  $('nest-description').textContent = 'Вылупился и поселился в твоём парке';
  $('nest').setAttribute('aria-label', `Вылупился ${SPECIES[species].name}`);
  $('solution').innerHTML = `<strong>Верно! ${equation(state.question)}</strong><p>${explanation(state.question)}</p>`;
  $('solution').hidden = false;
  $('next-button').innerHTML = `${state.round === ROUND_SIZE ? 'Мы справились!' : 'Следующее яйцо'}${icons.arrow}`;
  $('next-button').hidden = false;
  if (announce) $('feedback').textContent = `Верно! ${equation(state.question)}. Вылупился ${SPECIES[species].name}.`;
}

function answer(value, button) {
  const result = submitAnswer(state, value);
  if (result.status === 'ignored') return;
  save();
  if (result.status === 'incorrect') {
    button.classList.add('incorrect');
    button.setAttribute('aria-label', `Ответ ${value}. Попробуй другое число`);
    const q = state.question;
    $('feedback').textContent = q.answer === 0 ? 'Все листочки убрали. Какое число значит «ничего»?' : q.type === 'subtract' ? 'Давай проверим: посчитай только листочки без черты.' : 'Давай проверим. Коснись каждого листочка и посчитай.';
    $('nest').classList.add('helping');
    return;
  }
  render();
  renderReward();
  playSound();
  $('next-button').focus({ preventScroll: true });
}

function next() {
  cancelVoice();
  if (!advance(state)) return;
  save();
  render();
  $('tap-hint').textContent = 'Касайся листочков и считай по порядку';
  $(state.phase === 'complete' ? 'complete-title' : 'question-title').focus({ preventScroll: true });
  if (window.scrollY > $('play-screen').offsetTop) window.scrollTo({ top: 0, behavior: 'instant' });
}

function showHelp() {
  if (state.phase !== 'question') return;
  $('nest').classList.add('helping');
  for (const button of $('objects').querySelectorAll('.leaf-token:not(.removed)')) markToken(button);
  const count = state.question.answer;
  $('feedback').textContent = count === 0 ? 'Все листочки перечёркнуты. Ничего не осталось — это 0.' : `Посчитаем: ${Array.from({ length: count }, (_, i) => i + 1).join(', ')}. Всего ${count}. Найди это число.`;
  $('help-button').textContent = 'Посчитаем ещё раз';
}

function openGarden() {
  cancelVoice();
  $('garden-summary').textContent = state.total ? `В парке уже ${state.total}. Каждый появился благодаря твоему ответу!` : 'Здесь будут жить твои динозаврики. Реши первое задание!';
  $('garden-grid').innerHTML = SPECIES.map((species, i) => `<article class="dino-card${state.counts[i] ? '' : ' locked'}">${dinoSVG(i)}<h3>${state.counts[i] ? species.name : 'Кто-то прячется'}</h3><span class="dino-count">${state.counts[i] ? `В парке: ${state.counts[i]}` : 'Вылупится из яйца'}</span></article>`).join('');
  $('garden-dialog').showModal();
}

function openSettings() {
  cancelVoice();
  $('range-setting').value = state.settings.max;
  $('mode-setting').value = state.settings.mode;
  $('sound-setting').checked = state.settings.sound;
  $('learning-stats').innerHTML = Object.entries(state.stats).map(([type, stats]) => `<p><strong>${{ count: 'Счёт', add: 'Сложение', subtract: 'Вычитание' }[type]}</strong><span>Решено: ${stats.solved} · С первого раза: ${stats.firstTry}</span></p>`).join('');
  $('settings-dialog').showModal();
}

function cancelVoice() {
  clearTimeout(voiceTimer);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  $('read-question').removeAttribute('aria-busy');
}

function readQuestion() {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    $('feedback').textContent = 'Голос недоступен в этом браузере. Можно прочитать задание на экране.';
    return;
  }
  cancelVoice();
  const q = state.question;
  const text = state.phase === 'hatched' ? explanation(q) : `${q.type === 'count' ? '' : `Было ${q.a} листочков. ${q.type === 'add' ? 'Добавили' : 'Убрали'} ${q.b}. `}${typeTitle[q.type]}`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 0.85;
  const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('ru'));
  if (voice) utterance.voice = voice;
  let started = false;
  utterance.onstart = () => { started = true; clearTimeout(voiceTimer); };
  const done = () => $('read-question').removeAttribute('aria-busy');
  utterance.onend = done;
  utterance.onerror = event => {
    done();
    if (!['interrupted', 'canceled'].includes(event.error)) $('feedback').textContent = 'Не получилось включить голос. Задание можно прочитать на экране.';
  };
  $('read-question').setAttribute('aria-busy', 'true');
  // Safari requires speak() directly in the user gesture, without an await.
  try {
    speechSynthesis.speak(utterance);
    voiceTimer = setTimeout(() => {
      if (!started) {
        cancelVoice();
        $('feedback').textContent = 'Голос пока недоступен. Задание можно прочитать на экране.';
      }
    }, 3500);
  } catch {
    done();
    $('feedback').textContent = 'Голос недоступен. Задание можно прочитать на экране.';
  }
}

function playSound() {
  if (!state.settings.sound) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    [523.25, 659.25, 783.99].forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      const start = audioContext.currentTime + i * 0.11;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  } catch { /* Optional audio never blocks a correct answer. */ }
}

$('open-settings').innerHTML = icons.settings;
document.querySelector('.garden-icon').innerHTML = dinoSVG(0);
document.querySelector('.sound-icon').innerHTML = icons.sound;
for (const button of document.querySelectorAll('.close-dialog.icon-button')) button.innerHTML = icons.close;
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
}
$('answers').addEventListener('click', event => {
  const button = event.target.closest('[data-answer]');
  if (button) answer(Number(button.dataset.answer), button);
});
$('objects').addEventListener('click', event => {
  const button = event.target.closest('[data-token]');
  if (button && state.phase === 'question') markToken(button);
});
$('next-button').addEventListener('click', next);
$('help-button').addEventListener('click', showHelp);
$('read-question').addEventListener('click', readQuestion);
$('open-garden').addEventListener('click', openGarden);
$('complete-garden').addEventListener('click', openGarden);
$('open-settings').addEventListener('click', openSettings);
$('about-button').addEventListener('click', openSettings);
$('play-again').addEventListener('click', () => {
  startRound(state);
  save();
  render();
  $('question-title').focus({ preventScroll: true });
});
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  changeSettings(state, { max: Number($('range-setting').value), mode: $('mode-setting').value, sound: $('sound-setting').checked });
  save();
  $('settings-dialog').close();
  render();
});
window.addEventListener('pagehide', cancelVoice);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelVoice(); });
window.addEventListener('storage', event => {
  if (event.key === SAVE_KEY && event.newValue) {
    state = restoreState(event.newValue);
    render();
  }
});
save();
render();
