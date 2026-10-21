import { generate, rng } from './engine.js';

const ALL = 0b1111111110;
const bitCount = n => { let count = 0; for (; n; n &= n - 1) count++; return count; };
const combinations = new Map();
for (let mask = 2; mask <= ALL; mask += 2) {
  let sum = 0;
  for (let n = 1; n <= 9; n++) if (mask & (1 << n)) sum += n;
  const key = `${bitCount(mask)}:${sum}`;
  if (!combinations.has(key)) combinations.set(key, []);
  combinations.get(key).push(mask);
}

export function adjacent(i) {
  return [i % 9 > 0 ? i - 1 : -1, i % 9 < 8 ? i + 1 : -1, i >= 9 ? i - 9 : -1, i < 72 ? i + 9 : -1].filter(n => n >= 0);
}

// Exhausting the search budget conservatively reports ambiguity, never uniqueness.
export function countKillerSolutions(puzzle, cages, limit = 2, nodeLimit = 60000) {
  const board = [...puzzle], rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  const used = cages.map(() => 0), sums = cages.map(() => 0), remaining = cages.map(c => c.cells.length);
  const cageOf = Array(81).fill(-1);
  for (let k = 0; k < cages.length; k++) for (const i of cages[k].cells) {
    if (!Number.isInteger(i) || i < 0 || i >= 81 || cageOf[i] !== -1) return 0;
    cageOf[i] = k;
  }
  if (board.length !== 81 || cageOf.includes(-1)) return 0;
  const boxOf = i => Math.floor(i / 27) * 3 + Math.floor(i % 9 / 3);
  for (let i = 0; i < 81; i++) if (board[i]) {
    const n = board[i], bit = 1 << n, r = Math.floor(i / 9), c = i % 9, b = boxOf(i), k = cageOf[i];
    if (!Number.isInteger(n) || n < 1 || n > 9 || (rows[r] | cols[c] | boxes[b] | used[k]) & bit) return 0;
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; used[k] |= bit; sums[k] += n; remaining[k]--;
  }
  let total = 0, nodes = 0, exhausted = false;
  function visit() {
    if (++nodes > nodeLimit) { exhausted = true; return; }
    const cageOptions = cages.map((c, k) => {
      if (!remaining[k]) return sums[k] === c.sum ? ALL : 0;
      return (combinations.get(`${remaining[k]}:${c.sum - sums[k]}`) || []).reduce((mask, combo) => combo & used[k] ? mask : mask | combo, 0);
    });
    if (cageOptions.includes(0)) return;
    let best = -1, options = 0, size = 10;
    for (let i = 0; i < 81; i++) if (!board[i]) {
      const allowed = cageOptions[cageOf[i]] & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]);
      const count = bitCount(allowed);
      if (!count) return;
      if (count < size) { best = i; options = allowed; size = count; if (size === 1) break; }
    }
    if (best < 0) { total++; return; }
    const r = Math.floor(best / 9), c = best % 9, b = boxOf(best), k = cageOf[best];
    for (let n = 1; n <= 9; n++) if (options & (1 << n)) {
      const bit = 1 << n;
      board[best] = n; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; used[k] |= bit; sums[k] += n; remaining[k]--;
      visit();
      board[best] = 0; rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit; used[k] ^= bit; sums[k] -= n; remaining[k]++;
      if (total >= limit || exhausted) break;
    }
  }
  visit();
  return exhausted ? limit : total;
}

function connected(cells) {
  if (!cells.length) return false;
  const unseen = new Set(cells), stack = [cells[0]]; unseen.delete(cells[0]);
  while (stack.length) for (const n of adjacent(stack.pop())) if (unseen.delete(n)) stack.push(n);
  return !unseen.size;
}

export function generateKiller(level = 'easy', seed = Date.now()) {
  const { solution } = generate('easy', seed), random = rng(seed ^ 0x4b494c4c);
  const unassigned = new Set(Array.from({ length: 81 }, (_, i) => i)), cages = [];
  const choose = a => a[Math.floor(random() * a.length)];
  while (unassigned.size) {
    const cells = [choose([...unassigned])]; unassigned.delete(cells[0]);
    const target = { easy: 2, medium: 3, hard: 4 }[level] + (random() > .55 ? 1 : 0);
    while (cells.length < target) {
      const neighbors = [...new Set(cells.flatMap(adjacent))].filter(i => unassigned.has(i) && !cells.some(j => solution[i] === solution[j]));
      if (!neighbors.length) break;
      const next = choose(neighbors); cells.push(next); unassigned.delete(next);
    }
    cages.push({ cells: cells.sort((a, b) => a - b), sum: cells.reduce((sum, i) => sum + solution[i], 0) });
  }
  const puzzle = Array(81).fill(0);
  // Split connected cages until the sums and Sudoku rules identify exactly one solution.
  while (countKillerSolutions(puzzle, cages) !== 1) {
    const candidates = cages.filter(c => c.cells.length > 1).sort((a, b) => b.cells.length - a.cells.length);
    const cage = candidates[0];
    const cell = choose(cage.cells.filter(i => connected(cage.cells.filter(j => j !== i))));
    cage.cells = cage.cells.filter(i => i !== cell); cage.sum -= solution[cell];
    cages.push({ cells: [cell], sum: solution[cell] });
  }
  // Combine small neighboring cages where uniqueness survives, avoiding excessive single-cell clues.
  const goal = { easy: 38, medium: 32, hard: 27 }[level];
  const maxSize = { easy: 3, medium: 4, hard: 5 }[level];
  const edges = Array.from({ length: 81 }, (_, i) => adjacent(i).filter(j => j > i).map(j => [i, j])).flat();
  for (let i = edges.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [edges[i], edges[j]] = [edges[j], edges[i]]; }
  for (const [a, b] of edges) {
    if (cages.length <= goal) break;
    const first = cages.find(c => c.cells.includes(a)), second = cages.find(c => c.cells.includes(b));
    if (first === second || first.cells.length + second.cells.length > maxSize) continue;
    const cells = [...first.cells, ...second.cells].sort((a, b) => a - b);
    if (new Set(cells.map(i => solution[i])).size !== cells.length) continue;
    const merged = { cells, sum: first.sum + second.sum };
    const trial = cages.filter(c => c !== first && c !== second).concat(merged);
    if (countKillerSolutions(puzzle, trial, 2, 8000) === 1) cages.splice(0, cages.length, ...trial);
  }
  cages.sort((a, b) => a.cells[0] - b.cells[0]);
  return { puzzle, solution, cages };
}

export function cageStatus(cage, values) {
  const filled = cage.cells.map(i => values[i]).filter(Boolean);
  const sum = filled.reduce((a, b) => a + b, 0);
  const invalid = new Set(filled).size !== filled.length || sum > cage.sum || (filled.length === cage.cells.length ? sum !== cage.sum : sum >= cage.sum);
  return { sum, filled: filled.length, invalid, complete: !invalid && filled.length === cage.cells.length };
}
