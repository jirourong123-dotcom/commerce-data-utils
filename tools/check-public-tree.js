'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { isBuiltin } = require('node:module');

const allowed = new Set([
  '.github/workflows/ci.yml', '.gitignore', 'package.json', 'index.js',
  'README.md', 'PROVENANCE.md', 'SECURITY.md', 'CONTRIBUTING.md',
  'src/availability.js', 'src/materials.js', 'src/references.js', 'src/currency.js',
  'src/pagination.js', 'src/businessDate.js', 'src/fence.js', 'src/encoding.js',
  'tests/utilities.test.js', 'tests/public-tree.test.js', 'examples/demo.js',
  'tools/check-public-tree.js',
]);

function inspectFileContent(file, text) {
  const issues = [];
  const report = rule => issues.push({ file, rule });
  const rules = [
    ['provider-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|sk-proj-[A-Za-z0-9_-]{40,})\b/],
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['credential-url', /(?:mysql|postgres|redis|mongodb):\/\/[^\s:]+:[^\s@]+@/],
    ['literal-password', /(?:password|secret|access_token)\s*[:=]\s*["'][^"'\r\n]{8,}["']/i],
    ['ipv4-literal', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ];
  for (const [rule, regex] of rules) if (regex.test(text)) report(rule);
  for (const match of text.matchAll(/https?:\/\/[a-z0-9][a-z0-9.-]+/gi)) {
    if (!['https://docs.github.com'].includes(match[0])) report('unapproved-url');
  }
  if (file.endsWith('.js')) {
    for (const match of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      if (!match[1].startsWith('.') && !isBuiltin(match[1])) report('external-import');
    }
  }
  return issues;
}

function inspectPublicTree(root) {
  const issues = [];
  const seen = new Set();
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const file = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) { issues.push({ file, rule: 'symlink' }); continue; }
      if (file === '.git' && entry.isDirectory()) continue;
      if (entry.isDirectory()) {
        if (![...allowed].some(x => x.startsWith(file + '/'))) {
          issues.push({ file, rule: 'unapproved-path' });
        } else visit(absolute);
        continue;
      }
      seen.add(file);
      if (!allowed.has(file)) { issues.push({ file, rule: 'unapproved-path' }); continue; }
      const raw = fs.readFileSync(absolute);
      if (raw.length > 100000 || raw.includes(0)) { issues.push({ file, rule: 'binary-or-oversized' }); continue; }
      issues.push(...inspectFileContent(file, raw.toString('utf8')));
    }
  }
  visit(root);
  for (const file of allowed) if (!seen.has(file)) issues.push({ file, rule: 'missing-file' });
  return issues;
}

if (require.main === module) {
  const issues = inspectPublicTree(path.resolve(__dirname, '..'));
  console.log(JSON.stringify({ checkedPaths: allowed.size, issues }, null, 2));
  process.exitCode = issues.length ? 1 : 0;
}
module.exports = { inspectPublicTree, inspectFileContent };
