/**
 * Runs every gate: syntax, database consistency, and all maths harnesses.
 *
 * Run: npm test
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const gates = ['scripts/check-syntax.mjs', 'scripts/check-schema.mjs'];
const harnesses = readdirSync('scripts')
  .filter(f => /^test-.*\.mjs$/.test(f))
  .sort()
  .map(f => 'scripts/' + f);

let failed = [];

for (const script of [...gates, ...harnesses]) {
  const r = spawnSync('node', [script], { encoding: 'utf8' });
  const lines = (r.stdout || '').trimEnd().split('\n');
  const last = lines[lines.length - 1] || '(no output)';
  const name = script.replace('scripts/', '').replace('.mjs', '');
  if (r.status !== 0) {
    failed.push(name);
    console.log(`✗ ${name.padEnd(16)} ${last}`);
    // Show what actually failed, not just the tally.
    for (const l of lines) if (l.startsWith('✗')) console.log('    ' + l);
    if (r.stderr) console.log('    ' + r.stderr.trim().split('\n')[0]);
  } else {
    console.log(`✓ ${name.padEnd(16)} ${last}`);
  }
}

console.log(failed.length === 0
  ? `\nall ${gates.length + harnesses.length} checks passed`
  : `\n${failed.length} failed: ${failed.join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
