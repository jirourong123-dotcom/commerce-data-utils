'use strict';
const { materials, availability } = require('..');
// Fictional input only; no network, database or credentials.
const rows = materials.parseCatalogMaterialText('原料：DEMO01示例珠8mm*3=2*3');
const count = availability.calculateCatalogAvailableQuantityFromDetails(
  { materials: rows }, new Map([['DEMO01', 30]]),
);
console.log(JSON.stringify({ synthetic: true, components: rows.length, availableUnits: count }));
