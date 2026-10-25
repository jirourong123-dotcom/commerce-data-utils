// This evidence is trusted source configuration, never a row value or a symbol guess.
// Preserve identity types: bootstrap must explicitly normalize both keys if required.
function verifiedSourceCurrency(source) {
  if(!source || !['productPrice','price','material','accessory'].includes(source.kind || source.role))return null;
  const currency=source.currency, key=source.key || source.expectedIds;
  if(currency?.code!=='CNY' || currency.verified!==true || typeof currency.evidence!=='string' || !currency.evidence.trim() ||
    !key || !validIdentity(key.fileId) || !validIdentity(key.tableId) || !currency.sourceKey || currency.sourceKey.fileId!==key.fileId || currency.sourceKey.tableId!==key.tableId)return null;
  return 'CNY';
}
function validIdentity(value) { return typeof value==='string' ? value.trim().length>0 : Number.isSafeInteger(value) && value>0; }
module.exports={verifiedSourceCurrency};
