'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectPublicTree, inspectFileContent } = require('../tools/check-public-tree');
test('public candidate matches the reviewed allowlist', () => {
  assert.deepEqual(inspectPublicTree(require('node:path').resolve(__dirname, '..')), []);
});
test('guard detects a synthetic provider token without revealing its value', () => {
  const invented = ['ghp', '_', 'A'.repeat(36)].join('');
  const findings = inspectFileContent('src/demo.js', invented);
  assert.ok(findings.some(x => x.rule === 'provider-token'));
  assert.ok(!JSON.stringify(findings).includes(invented));
});
test('guard rejects unexpected URLs and external packages', () => {
  assert.ok(inspectFileContent('src/demo.js', 'https://' + 'unapproved.example.invalid').some(x => x.rule === 'unapproved-url'));
  const syntheticImport = ['require', "('external-package')"].join('');
  assert.ok(inspectFileContent('src/demo.js', syntheticImport).some(x => x.rule === 'external-import'));
});
test('guard rejects extra files even when they contain no recognized secret', () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'public-tree-synthetic-'));
  try {
    fs.writeFileSync(path.join(temp, 'unreviewed.txt'), 'synthetic');
    assert.ok(inspectPublicTree(temp).some(x => x.rule === 'unapproved-path'));
    assert.ok(inspectPublicTree(temp).some(x => x.rule === 'missing-file'));
  } finally {
    fs.unlinkSync(path.join(temp, 'unreviewed.txt'));
    fs.rmdirSync(temp);
  }
});
