function normalizeDisplayText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text === "-" || /^undefined$/i.test(text) || /^null$/i.test(text)) {
    return "";
  }
  return text;
}

function isLikelyMojibakeText(value) {
  const text = normalizeDisplayText(value);
  if (!text) {
    return false;
  }
  if (/[�锟]/u.test(text)) {
    return true;
  }
  if (/[ÃÂÐÑ]/u.test(text)) {
    return true;
  }
  if (/[€]/u.test(text) && /[寰鑽鎵閫涓霢鍏璧鏈錾寮鍙垝]/u.test(text)) {
    return true;
  }
  const suspiciousMatches = text.match(/[寰鑽鎵閫霢鍏璧鏈錾寮鍙垝]/gu) || [];
  if (suspiciousMatches.length >= 3 && suspiciousMatches.length / Math.max(text.length, 1) >= 0.35) {
    return true;
  }
  return false;
}

function repairMojibakeText(value) {
  const text = normalizeDisplayText(value);
  if (!text) {
    return "";
  }
  if (!/[ÃÂÅåæçèéäöü¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ\u0080-\u00ff]/u.test(text)) {
    return text;
  }
  try {
    const bytes = encodeWindows1252MojibakeBytes(text);
    if (!bytes) {
      return text;
    }
    const repaired = bytes.toString("utf8").replace(/\s+/g, " ").trim();
    if (repaired && repaired !== text && !isLikelyMojibakeText(repaired)) {
      return repaired;
    }
  } catch (_error) {
    return text;
  }
  return text;
}

const WINDOWS_1252_REVERSE_BYTES = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function encodeWindows1252MojibakeBytes(text) {
  const bytes = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const mappedByte = WINDOWS_1252_REVERSE_BYTES.get(codePoint);
    if (mappedByte == null) {
      return null;
    }
    bytes.push(mappedByte);
  }
  return Buffer.from(bytes);
}

function titleSpecCandidate(row = {}) {
  const title = normalizeDisplayText(row.productName || row.title || "");
  if (!title || isLikelyMojibakeText(title)) {
    return "";
  }
  if (title.includes("开口戒")) {
    return "开口戒";
  }
  return "";
}

function normalizeShippingSpecText(value, candidates = []) {
  const raw = normalizeDisplayText(value);
  if (raw && !isLikelyMojibakeText(raw)) {
    return raw;
  }
  const candidate = (Array.isArray(candidates) ? candidates : [candidates])
    .map(normalizeDisplayText)
    .find((item) => item && !isLikelyMojibakeText(item));
  if (candidate) {
    return candidate;
  }
  const repaired = repairMojibakeText(raw);
  if (repaired && !isLikelyMojibakeText(repaired)) {
    return repaired;
  }
  return raw ? "-" : "-";
}

function resolveShippingSpecDisplay(row = {}) {
  const raw = normalizeDisplayText(
    row.displaySpec ||
    row.spec ||
    row.ringSize ||
    row.specText ||
    row.specName ||
    row.specification ||
    row.skuName ||
    row.attrsRaw ||
    ""
  );
  const candidates = [
    row.detailSkuSpec,
    row.detailSpec,
    row.catalogSpec,
    row.sizeSpec,
    row.lengthText,
    row.catalogLengthText,
    row.specTextCanonical,
    titleSpecCandidate(row),
  ];
  return normalizeShippingSpecText(raw, candidates);
}

module.exports = {
  isLikelyMojibakeText,
  normalizeShippingSpecText,
  repairMojibakeText,
  resolveShippingSpecDisplay,
};
