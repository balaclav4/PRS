/**
 * Syntax gate for every source file.
 *
 * Exists because `node --check` silently does nothing. Node detects ESM syntax
 * and reparses, and in that path the check is skipped entirely — a file
 * containing `const x = <div/>;`, a duplicate `const`, and a literal
 * `function ((( {` all exit 0. Every check run against the JSX screens this
 * session was therefore worthless, and a duplicate declaration introduced by a
 * careless rename passed straight through it.
 *
 * @babel/parser is already a dependency and understands the JSX these files
 * actually contain.
 *
 * Run: node scripts/check-syntax.mjs
 */
import { parse } from '@babel/parser';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'components', 'lib', 'store', 'scripts'];
const SKIP = new Set(['node_modules', '.git', '.expo', 'dist']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap(r => walk(r));
let bad = 0;

for (const f of files) {
  try {
    parse(readFileSync(f, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false,
    });
  } catch (e) {
    bad++;
    console.log(`✗ ${f}\n    ${e.message}`);
  }
}

console.log(bad === 0
  ? `all ${files.length} files parse clean`
  : `${bad} of ${files.length} files failed to parse`);
process.exit(bad === 0 ? 0 : 1);
