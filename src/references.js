const { createHash } = require('node:crypto');

function referenceError(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
function text(value) { return typeof value === 'string' ? value : ''; }
function normalizeCode(value) { return text(value).trim().toUpperCase(); }
function hash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function normalizeReferenceRecord(source, raw) {
  const { namespace, fileId, tableId } = source.key || {};
  if (!['sample', 'live'].includes(namespace) || !fileId || !tableId) throw referenceError('SOURCE_KEY_INVALID');
  if (typeof raw.recordId !== 'string' || !raw.recordId.trim() || raw.recordId.length > 255) throw referenceError('RECORD_ID_INVALID');
  const fields = {};
  for (const name of ['codeRaw', 'productNameRaw', 'sizeRaw', 'lengthRaw', 'specRaw', 'materialRaw', 'productionTextRaw', 'sourceStatusRaw']) fields[name] = text(raw[name]);
  const unit = text(raw.bookUnit).trim() || null;
  const value = raw.bookQuantityRaw;
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ? Number(value.trim()) : NaN;
  // Dedicated source column: 成本单价（颗）, CNY per piece. Other prices are never substitutes.
  const costRaw = raw.costUnitPricePieceRaw;
  const costText = typeof costRaw === 'string' ? costRaw.trim() : typeof costRaw === 'number' && Number.isFinite(costRaw) ? String(costRaw) : '';
  const costUnitPricePiece = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(costText) && Number.isFinite(Number(costText)) ? costText : null;
  const liveRaw = raw.livePriceRaw;
  const liveText = typeof liveRaw === 'string' ? liveRaw.trim() : typeof liveRaw === 'number' && Number.isFinite(liveRaw) ? String(liveRaw) : '';
  const livePrice = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(liveText) && Number.isFinite(Number(liveText)) ? liveText : null;
  const payload = { ...fields, codeNormalized: normalizeCode(fields.codeRaw), bookQuantityRaw: typeof value === 'number' || typeof value === 'string' ? value : null, bookQuantity: unit && Number.isFinite(numeric) ? numeric : null, bookUnit: unit };
  if (Object.hasOwn(raw,'productFeatureRaw')) payload.productFeatureRaw = text(raw.productFeatureRaw);
  if (Object.hasOwn(raw,'metalFittingsRaw')) payload.metalFittingsRaw = text(raw.metalFittingsRaw);
  if (Object.hasOwn(raw,'auxCodeRaw')) payload.auxCodeRaw = text(raw.auxCodeRaw);
  if (Object.hasOwn(raw,'costUnitPricePieceRaw')) Object.assign(payload,{costUnitPricePieceRaw:typeof costRaw==='number' || typeof costRaw==='string'?costRaw:null,costUnitPricePiece});
  if (Object.hasOwn(raw,'livePriceRaw')) Object.assign(payload,{livePriceRaw:typeof liveRaw==='number' || typeof liveRaw==='string'?liveRaw:null,livePrice});
  // Optional image URL only (http/https). Attachment blobs are never stored on the record payload.
  if (Object.hasOwn(raw,'imageUrlRaw')) {
    const imageRaw = typeof raw.imageUrlRaw === 'string' ? raw.imageUrlRaw : '';
    const imageUrl = text(imageRaw).trim();
    payload.imageUrlRaw = imageRaw || null;
    payload.imageUrl = /^https?:\/\//i.test(imageUrl) && imageUrl.length <= 2048 ? imageUrl : null;
  }
  return { sourceId: source.id, key: { namespace, fileId, tableId, recordId: raw.recordId }, ...payload, contentHash: hash(payload), capturedAt: typeof raw.capturedAt === 'string' && Number.isFinite(Date.parse(raw.capturedAt)) ? new Date(raw.capturedAt).toISOString() : null };
}
function parseProductionLines(rawText) {
  return text(rawText).split(/\r?\n|[;；]/).map((rawText, index) => {
    // The first equals separates usage from cost notes; neither code nor quantity
    // may be inferred from the expression on its right.
    const usageText = rawText.split(/[=＝]/, 1)[0];
    const code = usageText.match(/(?:^|[\s(（])([A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)(?=$|[^A-Za-z0-9_-])/);
    const quantity = usageText.match(/[*×]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/);
    return { lineKey: `${index}-${hash(rawText).slice(0, 16)}`, rawText, explicitCode: code ? normalizeCode(code[1]) : null, quantityText: quantity ? quantity[1] : null };
  }).filter(line => line.rawText.trim());
}
function matchReferenceLines(lines, candidates) {
  return lines.map(line => {
    const matches = line.explicitCode ? candidates.filter(record => record.codeNormalized === line.explicitCode) : [];
    const ids = [...new Set(matches.map(record => record.id))];
    return { ...line, status: ids.length > 1 ? 'conflict' : ids.length === 1 ? 'candidate' : 'unmatched', candidateRecordIds: ids };
  });
}
module.exports = { normalizeReferenceRecord, parseProductionLines, matchReferenceLines, normalizeCode, hash, referenceError };
