function normalizeCatalogAvailableCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeCatalogAvailableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function calculateCatalogAvailableQuantityFromDetails(details = null, stockByCode = new Map()) {
  const source = details && typeof details === "object" ? details : {};
  const rows = [
    ...(Array.isArray(source.materials) ? source.materials : []),
    ...(Array.isArray(source.accessories) ? source.accessories : []),
  ]
    .map((item) => {
      const code = normalizeCatalogAvailableCode(item?.code);
      const quantity = normalizeCatalogAvailableNumber(item?.quantity);
      const stock = stockByCode.has(code)
        ? normalizeCatalogAvailableNumber(stockByCode.get(code))
        : normalizeCatalogAvailableNumber(item?.stock);
      return { code, quantity, stock };
    })
    .filter((item) => item.code && item.quantity !== null && item.quantity > 0);
  if (!rows.length || rows.some((item) => item.stock === null)) {
    return null;
  }
  const result = Math.min(...rows.map((item) => Math.floor(item.stock / item.quantity)));
  return Number.isFinite(result) ? Math.max(0, result) : null;
}

module.exports = {
  calculateCatalogAvailableQuantityFromDetails,
};
