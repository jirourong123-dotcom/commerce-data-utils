'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('..');

// All codes, identities, quantities, amounts and timestamps below are fabricated.
test('availability uses the limiting component and leaves inputs untouched', () => {
  const details = { materials: [{ code: 'demo01', quantity: 2, stock: 11 }], accessories: [{ code: 'demo02', quantity: 3, stock: 20 }] };
  const before = structuredClone(details);
  assert.equal(utils.availability.calculateCatalogAvailableQuantityFromDetails(details), 5);
  assert.deepEqual(details, before);
});
test('availability reports unknown stock instead of an invented count', () => {
  const calculate = utils.availability.calculateCatalogAvailableQuantityFromDetails;
  assert.equal(calculate({ materials: [{ code: 'DEMO01', quantity: 2 }] }), null);
  assert.equal(calculate(), null);
  assert.equal(calculate({ materials: [{ code: 'DEMO01', quantity: 0, stock: 7 }] }), null);
  assert.equal(calculate({ materials: [{ code: 'DEMO01', quantity: 2, stock: -1 }] }), 0);
});
test('explicit stock map takes precedence and parses formatted numbers', () => {
  const calculate = utils.availability.calculateCatalogAvailableQuantityFromDetails;
  assert.equal(calculate({ materials: [{ code: ' demo01 ', quantity: 2, stock: 99 }] }, new Map([['DEMO01', '1,000']])), 500);
});
test('material parser handles synthetic full-width equals and quantity/cost', () => {
  const row = utils.materials.parseCatalogMaterialLine('原料：DEMO01示例珠8mm*3＝2*3');
  assert.equal(row.code, 'DEMO01');
  assert.equal(row.productName, '示例珠');
  assert.equal(row.spec, '8mm');
  assert.equal(row.quantity, 3);
  assert.equal(row.unitCost, 2);
  assert.equal(row.subtotal, 6);
});
test('material parser classifies accessories and ignores summary lines', () => {
  const rows = utils.materials.parseCatalogMaterialText('配件：DEMO02示例扣*2=4；合计 4\n暂无');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'accessory');
  assert.deepEqual(utils.materials.parseCatalogMaterialText(''), []);
});
test('structured materials normalize aliases without mutating original', () => {
  const product = { productionDetails: { materials: [{ skuCode: 'DEMO01', name: '示例', qty: 2, inventoryStock: 8 }] } };
  const before = structuredClone(product);
  const normalized = utils.materials.normalizeCatalogMaterialRows(product);
  assert.deepEqual(normalized.materials, [{ code: 'DEMO01', productName: '示例', quantity: 2, spec: '', stock: 8 }]);
  assert.deepEqual(product, before);
});

const source = { id: 'demo-source', key: { namespace: 'sample', fileId: 'demo-file', tableId: 'demo-table' } };
test('reference normalization binds synthetic identity and numeric quantity to a unit', () => {
  const result = utils.references.normalizeReferenceRecord(source, { recordId: 'demo-row', codeRaw: ' demo01 ', bookQuantityRaw: '2.5', bookUnit: 'piece', livePriceRaw: '5.00', capturedAt: '2025-01-01T00:00:00Z' });
  assert.equal(result.codeNormalized, 'DEMO01');
  assert.equal(result.bookQuantity, 2.5);
  assert.equal(result.livePrice, '5.00');
  assert.equal(result.capturedAt, '2025-01-01T00:00:00.000Z');
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
});
test('reference rejects invalid keys and non-string row identity', () => {
  assert.throws(() => utils.references.normalizeReferenceRecord({ key: {} }, { recordId: 'demo-row' }), { code: 'SOURCE_KEY_INVALID' });
  assert.throws(() => utils.references.normalizeReferenceRecord(source, { recordId: 1 }), { code: 'RECORD_ID_INVALID' });
});
test('reference preserves unknown quantity and rejects executable image schemes', () => {
  const result = utils.references.normalizeReferenceRecord(source, { recordId: 'demo-row', bookQuantityRaw: '3', imageUrlRaw: 'javascript:void(0)', capturedAt: 'invalid' });
  assert.equal(result.bookQuantity, null);
  assert.equal(result.imageUrl, null);
  assert.equal(result.capturedAt, null);
});
test('production line parser never derives usage from the cost side', () => {
  const lines = utils.references.parseProductionLines('DEMO01 * 2 = 9 * 7\n示例文字 = DEMO02 * 4');
  assert.equal(lines[0].explicitCode, 'DEMO01');
  assert.equal(lines[0].quantityText, '2');
  assert.equal(lines[1].explicitCode, null);
  assert.equal(lines[1].quantityText, null);
});
test('reference matching exposes ambiguity rather than choosing an arbitrary record', () => {
  const lines = utils.references.parseProductionLines('DEMO01 * 2\nDEMO02 * 1\nDEMO03 * 1');
  const results = utils.references.matchReferenceLines(lines, [{ id: 'demo-a', codeNormalized: 'DEMO01' }, { id: 'demo-b', codeNormalized: 'DEMO01' }, { id: 'demo-c', codeNormalized: 'DEMO02' }]);
  assert.deepEqual(results.map(x => x.status), ['conflict', 'candidate', 'unmatched']);
});

function currencySource() {
  return { kind: 'material', key: { fileId: 'demo-file', tableId: 'demo-table' }, currency: { code: 'CNY', verified: true, evidence: 'synthetic unit-test assertion', sourceKey: { fileId: 'demo-file', tableId: 'demo-table' } } };
}
test('currency requires explicit verified source-bound evidence', () => {
  assert.equal(utils.currency.verifiedSourceCurrency(currencySource()), 'CNY');
  const invalid = currencySource(); invalid.currency.verified = false;
  assert.equal(utils.currency.verifiedSourceCurrency(invalid), null);
  assert.equal(utils.currency.verifiedSourceCurrency(null), null);
});
test('currency refuses a mismatched identity or unsupported currency', () => {
  const mismatch = currencySource(); mismatch.currency.sourceKey.fileId = 'different-demo-file';
  assert.equal(utils.currency.verifiedSourceCurrency(mismatch), null);
  const unsupported = currencySource(); unsupported.currency.code = 'USD';
  assert.equal(utils.currency.verifiedSourceCurrency(unsupported), null);
});

test('pagination normalizes defaults, last page and all mode', () => {
  const normalize = utils.pagination.normalizeShippingPageRequest;
  assert.deepEqual(normalize({}, 101), { page: 1, pageSize: 50, limit: 50, totalPages: 3 });
  assert.equal(normalize({ page: 999 }, 101).page, 3);
  assert.equal(normalize({ pageSize: 'all' }, 101).limit, 101);
  assert.equal(normalize({}, 0).totalPages, 0);
});
test('legacy limit only applies when explicitly enabled', () => {
  const normalize = utils.pagination.normalizeShippingPageRequest;
  assert.equal(normalize({ limit: 7 }, 100).pageSize, 50);
  assert.equal(normalize({ limit: 7 }, 100, { allowLegacyLimit: true }).pageSize, 7);
});
test('revision is order independent but changes when quantity changes', () => {
  const rows = [{ identity: 'demo-a', shopId: 1, totalQuantity: 2 }, { identity: 'demo-b', shopId: 2, totalQuantity: 4 }];
  const revision = utils.pagination.buildShippingDatasetRevision;
  assert.equal(revision(rows), revision([...rows].reverse()));
  assert.notEqual(revision(rows), revision([{ ...rows[0], totalQuantity: 3 }, rows[1]]));
});
test('pagination snapshot distinguishes unknown quantity from zero', () => {
  const metadata = utils.pagination.buildShippingPaginationMetadata;
  const base = { page: 1, pageSize: 50, totalRows: 2, currentPageRows: 2, datasetRevision: 'demo-revision' };
  assert.notEqual(metadata(base).snapshotToken, metadata({ ...base, pendingEntryQuantity: 0 }).snapshotToken);
});

test('Shanghai date respects the UTC day boundary', () => {
  assert.equal(utils.businessDate.getShanghaiBusinessDate('2025-01-01T15:59:59Z'), '2025-01-01');
  assert.equal(utils.businessDate.getShanghaiBusinessDate('2025-01-01T16:00:00Z'), '2025-01-02');
  assert.throws(() => utils.businessDate.getShanghaiBusinessDate('not-a-date'), TypeError);
});
test('dataset fence requires both revisions and is immutable', () => {
  assert.throws(() => utils.fence.createShippingDatasetFence({ visibilityRevision: 'demo-v1' }), TypeError);
  const fence = utils.fence.createShippingDatasetFence({ visibilityRevision: 'demo-v1', dataGeneration: 'demo-g1' });
  assert.ok(Object.isFrozen(fence));
  assert.ok(utils.fence.isShippingDatasetFenceCompatible(fence, { ...fence }));
  assert.equal(utils.fence.isShippingDatasetFenceCompatible(fence, { ...fence, dataGeneration: 'demo-g2' }), false);
  assert.equal(utils.fence.isShippingDatasetFenceCompatible(null, fence), false);
});
test('encoding preserves valid text and repairs simple UTF-8 mojibake', () => {
  assert.equal(utils.encoding.repairMojibakeText('正常示例'), '正常示例');
  assert.equal(utils.encoding.repairMojibakeText('cafÃ©'), 'café');
  assert.equal(utils.encoding.normalizeShippingSpecText('�', ['合成规格']), '合成规格');
  assert.equal(utils.encoding.normalizeShippingSpecText('�'), '-');
});
