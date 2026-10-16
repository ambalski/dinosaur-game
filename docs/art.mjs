import { SPECIES } from './engine.mjs';

export const icons = {
  leaf: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 6C18 3 4 16 9 30c4 13 29 14 30-24Z" fill="currentColor"/><path d="m9 40 22-25M19 29l-2-9m8 3 8-1" fill="none" stroke="#fff9e8" stroke-width="2.8" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--paper)"/><circle cx="16" cy="17" r="3" fill="var(--paper)"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>',
};

export function eggSVG(className = '') {
  return `<svg class="${className}" viewBox="0 0 160 180" aria-hidden="true"><ellipse cx="80" cy="164" rx="53" ry="9" fill="#d3d4ae" opacity=".5"/><g class="egg-shell"><path d="M80 12c-25 0-55 57-55 92 0 38 22 59 55 59s55-21 55-59c0-35-30-92-55-92Z" fill="#f4d99d" stroke="#b58e57" stroke-width="2.5"/><path d="M66 25c-16 17-30 51-30 76" fill="none" stroke="#fff6d7" stroke-width="8" stroke-linecap="round"/><ellipse cx="97" cy="56" rx="10" ry="14" transform="rotate(-28 97 56)" fill="#d5b777"/><ellipse cx="57" cy="108" rx="12" ry="9" transform="rotate(20 57 108)" fill="#d5b777"/><ellipse cx="104" cy="127" rx="13" ry="9" transform="rotate(-35 104 127)" fill="#d5b777"/><path class="egg-crack" d="m34 91 25 7 15-18 16 24 19-13 20 9" fill="none" stroke="#b58e57" stroke-width="3" stroke-linejoin="round"/></g></svg>`;
}

export function dinoSVG(index, className = '') {
  const { color, dark, light } = SPECIES[index];
  const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="3.8" fill="#283b32"/><circle cx="${x + 1}" cy="${y - 1}" r="1.2" fill="#fff"/>`;
  const smile = (x, y) => `<path d="m${x} ${y}q8 6 13-1" fill="none" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/>`;
  const feet = `<path d="M67 111v25q0 7 8 7h12v-32m28 0v25q0 7 8 7h12v-34" fill="${dark}"/><path d="M54 106v32q0 7 8 7h15v-34m29 0v27q0 7 8 7h15v-36" fill="${color}"/>`;
  let body;
  if (index === 0) {
    body = `<path d="M57 109Q25 116 14 91q18 10 39-1" fill="${color}"/>${feet}<ellipse cx="89" cy="101" rx="43" ry="27" fill="${color}"/><path d="M114 109c21-2 23-27 23-54V35h-23v46q0 8-11 11" fill="${color}"/><path d="M121 87v-34" stroke="${light}" stroke-width="12" stroke-linecap="round"/><ellipse cx="132" cy="32" rx="26" ry="19" fill="${color}"/>${eye(141, 27)}${smile(138, 37)}<circle cx="146" cy="38" r="4" fill="#dc9c87"/><path d="m62 81 9 4m7-7 9 3m8-1 9 4" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>`;
  } else if (index === 1) {
    body = `<path d="m56 104-39-18 7 24 34 5" fill="${color}"/>${feet}<ellipse cx="83" cy="100" rx="44" ry="28" fill="${color}"/><path d="M115 50q-17-8-22 9-18 3-10 21-14 13 1 23 0 22 22 21 14 15 27-4l7-39Z" fill="${dark}"/><path d="M119 62q-25-7-26 15-9 18 9 27 18 19 28 2" fill="${light}"/><path d="M120 71q29-8 39 16l6 24q-10 17-41 1-19-9-4-41Z" fill="${color}"/><path d="m129 76 5-26 10 31m7 21 19-8-7 18" fill="#fff3d5" stroke="${dark}" stroke-width="1.5"/>${eye(144, 89)}${smile(145, 110)}`;
  } else if (index === 2) {
    body = `<path d="m54 110-40-15 17 26 31 1" fill="${color}"/><path d="m42 86 6-24 17 15 9-34 22 27 19-26 9 35 24-8-7 29" fill="#db9b7c" stroke="${dark}" stroke-width="1.5"/>${feet}<ellipse cx="88" cy="101" rx="48" ry="29" fill="${color}"/><path d="M117 99q24-17 41-2 14 11-1 22-16 6-38-1" fill="${color}"/>${eye(149, 103)}${smile(147, 114)}<path d="m66 96 10-5m11 8 11-5m6 14 9-4" stroke="${light}" stroke-width="7" stroke-linecap="round"/>`;
  } else if (index === 3) {
    body = `<path d="M83 112q-41 24-66-19 36 21 57-8" fill="${color}"/><path d="M86 111v27H68q-7 12 23 10l10-32m18-13 8 33h-11q-8 11 19 10l-1-40" fill="${dark}"/><path d="M75 109q-2-22 24-49l34 8q7 21 2 41-22 26-60 0" fill="${color}"/><ellipse cx="109" cy="103" rx="16" ry="24" fill="${light}"/><path d="M100 66q-12-41 24-42h27q21 3 17 30-3 21-38 21" fill="${color}"/>${eye(145, 37)}<path d="m146 58 18-1" stroke="${dark}" stroke-width="2.5" stroke-linecap="round"/><path d="m153 58 3 6 4-7" fill="#fff3d5"/><path d="m126 88 17 6 3-5" stroke="${dark}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  } else if (index === 4) {
    body = `<path d="m72 106-55-14q11 26 55 27" fill="${color}"/>${feet}<ellipse cx="88" cy="102" rx="40" ry="26" fill="${color}"/><path d="m108 109 4-56 24 1-4 56" fill="${color}"/><path d="M135 35Q108 9 87 20q16 4 24 24" fill="${dark}"/><ellipse cx="133" cy="52" rx="27" ry="22" fill="${color}"/><path d="M137 62h27q8 10-5 14l-30-7" fill="${color}"/>${eye(145, 48)}${smile(147, 68)}<path d="m63 90 11-5m9 8 11-5" stroke="${light}" stroke-width="7" stroke-linecap="round"/>`;
  } else {
    body = `<path d="M62 111 25 97" stroke="${color}" stroke-width="12" stroke-linecap="round"/><path d="M25 96q-13-16-20-1-5 16 13 16 20 6 18-9Z" fill="${dark}"/>${feet}<ellipse cx="87" cy="101" rx="49" ry="29" fill="${color}"/><path d="m43 84 7-14 12 6 8-16 14 12 14-15 11 19 15-7 9 24" fill="${dark}"/><ellipse cx="87" cy="93" rx="41" ry="22" fill="${color}"/><path d="m63 82 8 6-3 10-11-1-2-10m27-13 10 5-1 11-10 4-8-9m29 7 10 5-1 11-10 2-7-9m-28 10 11-1 6 9-7 7-11-4" fill="${light}"/><ellipse cx="141" cy="107" rx="25" ry="18" fill="${color}"/>${eye(151, 102)}${smile(149, 113)}`;
  }
  return `<svg class="${className}" viewBox="0 0 180 160" aria-hidden="true"><ellipse cx="91" cy="148" rx="64" ry="7" fill="#304c38" opacity=".09"/>${body}</svg>`;
}
