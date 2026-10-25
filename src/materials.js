function cleanText(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCode(value) {
  return cleanText(value).toUpperCase();
}

function decimal(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getKnownMaterialCodePrefix(left, materialCodes = []) {
  const normalizedLeft = normalizeCode(left);
  return [...new Set(materialCodes.map(normalizeCode).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .find((code) => normalizedLeft.startsWith(code)) || "";
}

function getFallbackMaterialCodePrefix(left) {
  const match = cleanText(left).match(/^[A-Za-z]{1,10}\d{2,}(?:[A-Za-z](?=[\u4e00-\u9fff\d]|$))?/);
  return match ? normalizeCode(match[0]) : "";
}

function getCatalogMaterialCodeCandidatesFromLine(rawLine = "") {
  const normalized = cleanText(rawLine).replace(/＝/g, "=").replace(/^(原料|配件)\s*[:：]\s*/, "");
  const left = normalized.split("=")[0].trim();
  const match = left.match(/^([A-Za-z]{1,10})(\d{2,})([A-Za-z]*)/);
  if (!match) return [];
  const base = normalizeCode(`${match[1]}${match[2]}`);
  const suffixed = match[3] ? `${base}${match[3][0].toUpperCase()}` : "";
  return [...new Set([suffixed, base].filter(Boolean))];
}

function getCatalogMaterialCodeCandidatesFromText(rawText = "") {
  return [...new Set(splitMaterialText(rawText).flatMap(getCatalogMaterialCodeCandidatesFromLine))];
}

function parseCostExpression(right, quantity) {
  const expression = cleanText(right).replace(/[¥￥]/g, "");
  if (!expression) {
    return { unitCost: null, subtotal: null };
  }
  const multiplied = expression.match(/^(\d+(?:\.\d+)?)\s*(?:\*|×|x|X)\s*(\d+(?:\.\d+)?)(?:\s*=\s*(\d+(?:\.\d+)?))?$/);
  if (multiplied) {
    const unitCost = decimal(multiplied[1]);
    const multiplier = decimal(multiplied[2]);
    const subtotal = multiplied[3] === undefined
      ? Number((unitCost * multiplier).toFixed(2))
      : decimal(multiplied[3]);
    return { unitCost, subtotal };
  }
  const single = expression.match(/^(\d+(?:\.\d+)?)$/);
  if (!single) {
    return { unitCost: null, subtotal: null };
  }
  const subtotal = decimal(single[1]);
  const unitCost = quantity > 0 ? Number((subtotal / quantity).toFixed(6)) : null;
  return { unitCost, subtotal };
}

function parseCatalogMaterialLine(rawLine = "", context = {}) {
  const rawText = cleanText(rawLine);
  if (!rawText || /^=+$/.test(rawText) || /^(?:合计|小计|总计|暂无|没有)/.test(rawText)) {
    return null;
  }
  const normalizedRawText = rawText.replace(/＝/g, "=");
  const typeMatch = normalizedRawText.match(/^(原料|配件)\s*[:：]\s*/);
  const contentText = typeMatch ? normalizedRawText.slice(typeMatch[0].length) : normalizedRawText;
  const firstEquals = contentText.indexOf("=");
  const left = cleanText(firstEquals >= 0 ? contentText.slice(0, firstEquals) : contentText);
  const right = firstEquals >= 0 ? contentText.slice(firstEquals + 1) : "";
  if (!left || /^[¥￥]?\d+(?:\.\d+)?\s*(?:\*|×|x|X)\s*\d+(?:\.\d+)?$/.test(left)) {
    return null;
  }

  const quantityMatch = left.match(/\s*(?:\*|×|x|X)\s*(\d+(?:\.\d+)?)\s*$/);
  const quantity = quantityMatch ? decimal(quantityMatch[1]) : null;
  let description = quantityMatch ? left.slice(0, quantityMatch.index).trim() : left;
  const code = getKnownMaterialCodePrefix(description, context.materialCodes) ||
    getFallbackMaterialCodePrefix(description);
  if (code) {
    description = description.slice(code.length).trim();
  }

  const specMatch = description.match(/(\d+(?:\.\d+)?)\s*m{1,2}(?=[A-Za-z\u4e00-\u9fff]|$)/i);
  const spec = specMatch ? `${specMatch[1]}mm` : "";
  if (specMatch) {
    description = `${description.slice(0, specMatch.index)}${description.slice(specMatch.index + specMatch[0].length)}`.trim();
  }
  const productName = cleanText(description);
  if (!productName || (!code && quantity === null && !spec)) {
    return null;
  }

  const { unitCost, subtotal } = parseCostExpression(right, quantity);
  return {
    code,
    productName,
    spec,
    quantity,
    unitCost,
    subtotal,
    rawText,
    textOnly: true,
    ...(typeMatch?.[1] === "配件" ? { type: "accessory" } : {}),
  };
}

function splitMaterialText(text = "") {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .split(/[\n;；]+/)
    .map(cleanText)
    .filter(Boolean);
}

function parseCatalogMaterialText(rawText = "", context = {}) {
  return splitMaterialText(rawText)
    .map((line) => parseCatalogMaterialLine(line, context))
    .filter(Boolean);
}

function normalizeStructuredRow(row = {}) {
  const normalized = {
    ...row,
    code: cleanText(row.code || row.productCode || row.skuCode || row.materialCode),
    productName: cleanText(row.productName || row.name || row.materialName || row.mainMaterial),
    spec: cleanText(row.spec || row.lengthText || row.sizeSpec || row.materialSpec || row.feature),
    quantity: row.quantity ?? row.count ?? row.qty ?? row.requiredQuantity ?? null,
  };
  if (normalized.stock === undefined && row.totalStock !== undefined) normalized.stock = row.totalStock;
  if (normalized.stock === undefined && row.inventoryStock !== undefined) normalized.stock = row.inventoryStock;
  for (const alias of ["productCode", "skuCode", "materialCode", "name", "materialName", "mainMaterial", "lengthText", "sizeSpec", "materialSpec", "feature", "count", "qty", "requiredQuantity", "totalStock", "inventoryStock"]) {
    delete normalized[alias];
  }
  return normalized;
}

function normalizeCatalogMaterialRows(product = {}, context = {}) {
  const details = product?.productionDetails && typeof product.productionDetails === "object"
    ? product.productionDetails
    : {};
  const materialRows = Array.isArray(details.materials) ? details.materials : [];
  const accessoryRows = Array.isArray(details.accessories) ? details.accessories : [];
  const reliableMaterials = materialRows.filter((row) => !(row?.textOnly && row?.rawText));
  const reliableAccessories = accessoryRows.filter((row) => !(row?.textOnly && row?.rawText));
  const legacyRows = [...materialRows, ...accessoryRows].filter((row) => row?.textOnly && row?.rawText);
  if ((materialRows.length || accessoryRows.length) && !legacyRows.length) {
    return {
      materials: materialRows.map(normalizeStructuredRow),
      accessories: accessoryRows.map(normalizeStructuredRow),
    };
  }

  const rawSource = legacyRows
    .map((row) => row.rawText)
    .join("\n") || product?.shippingRequirement || product?.productionRequirement || "";
  const parsedRows = parseCatalogMaterialText(rawSource, context);
  return {
    materials: [
      ...reliableMaterials.map(normalizeStructuredRow),
      ...parsedRows.filter((row) => row.type !== "accessory"),
    ],
    accessories: [
      ...reliableAccessories.map(normalizeStructuredRow),
      ...parsedRows.filter((row) => row.type === "accessory"),
    ],
  };
}

module.exports = {
  getCatalogMaterialCodeCandidatesFromText,
  parseCatalogMaterialLine,
  parseCatalogMaterialText,
  normalizeCatalogMaterialRows,
};
