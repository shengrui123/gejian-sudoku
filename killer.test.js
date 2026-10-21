import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKiller, countKillerSolutions, adjacent, cageStatus } from './killer.js';

for (const level of ['easy', 'medium', 'hard']) {
  test(`killer ${level}: connected non-repeating cages, full coverage and unique solution`, () => {
    for (const seed of [1, 42, 20261021]) {
      const { puzzle, solution, cages } = generateKiller(level, seed);
      assert.ok(puzzle.every(n => n === 0), 'Killer starts without given digits');
      assert.equal(new Set(cages.flatMap(c => c.cells)).size, 81);
      assert.equal(cages.flatMap(c => c.cells).length, 81);
      for (const cage of cages) {
        const cells = new Set(cage.cells), reached = new Set([cage.cells[0]]), stack = [cage.cells[0]];
        while (stack.length) for (const n of adjacent(stack.pop())) if (cells.has(n) && !reached.has(n)) { reached.add(n); stack.push(n); }
        assert.equal(reached.size, cells.size, 'Cage must be connected');
        assert.equal(new Set(cage.cells.map(i => solution[i])).size, cage.cells.length);
        assert.equal(cage.sum, cage.cells.reduce((sum, i) => sum + solution[i], 0));
        assert.ok(cageStatus(cage, solution).complete);
      }
      assert.equal(countKillerSolutions(puzzle, cages), 1);
      assert.equal(countKillerSolutions(solution, cages), 1);
      const invalid = [...solution]; invalid[0] = solution[1];
      assert.equal(countKillerSolutions(invalid, cages), 0);
    }
  });
}
test('killer daily generation is deterministic', () => assert.deepEqual(generateKiller('medium', 123), generateKiller('medium', 123)));
test('cage validation catches duplicates, overflow and wrong completed sums', () => {
  const cage = { cells: [0, 1], sum: 7 };
  assert.equal(cageStatus(cage, [0, 0]).invalid, false);
  assert.equal(cageStatus(cage, [3, 0]).invalid, false);
  assert.equal(cageStatus(cage, [3, 3]).invalid, true);
  assert.equal(cageStatus(cage, [8, 0]).invalid, true);
  assert.equal(cageStatus(cage, [7, 0]).invalid, true);
  assert.equal(cageStatus(cage, [1, 2]).invalid, true);
  assert.equal(cageStatus(cage, [3, 4]).complete, true);
});
test('solver respects cage rules outside standard Sudoku peers', () => {
  const { solution, cages } = generateKiller('easy', 1);
  const impossible = cages.map(c => ({ ...c })); impossible[0] = { ...impossible[0], sum: 99 };
  assert.equal(countKillerSolutions(Array(81).fill(0), impossible), 0);
  assert.equal(countKillerSolutions(Array(81).fill(0), [{ cells: Array.from({length:81},(_,i)=>i), sum:405 }]), 0);
  assert.equal(countKillerSolutions(solution, cages.slice(1)), 0);
});
test('solver distinguishes ambiguous boards from unique puzzles', () => {
  const rowCages = Array.from({ length: 9 }, (_, r) => ({ cells: Array.from({ length: 9 }, (_, c) => r * 9 + c), sum: 45 }));
  assert.equal(countKillerSolutions(Array(81).fill(0), rowCages), 2);
});
