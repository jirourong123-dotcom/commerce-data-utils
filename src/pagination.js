const crypto = require("node:crypto");

const ALLOWED_PAGE_SIZES = new Set([50, 100, 150, 200]);
const DEFAULT_PAGE_SIZE = 50;

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function normalizeShippingPageSize(value) {
  if (String(value ?? "").trim().toLowerCase() === "all") return "all";
  const pageSize = Number(value);
  return ALLOWED_PAGE_SIZES.has(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
}

function normalizeShippingPageRequest(query = {}, totalRows, options = {}) {
  const hasExplicitPageSize = query.pageSize !== undefined || query.page_size !== undefined;
  const legacyLimit = Math.floor(Number(query.limit));
  const preserveLegacyLimit = !hasExplicitPageSize
    && options.allowLegacyLimit === true
    && Number.isFinite(legacyLimit)
    && legacyLimit > 0;
  const pageSize = preserveLegacyLimit
    ? Math.min(legacyLimit, Math.max(1, Number(options.maxLegacyLimit) || 5000))
    : normalizeShippingPageSize(query.pageSize ?? query.page_size ?? query.limit);
  const requestedPage = Math.max(1, Math.floor(Number(query.page) || 1));
  const hasTotalRows = Number.isFinite(Number(totalRows));
  const normalizedTotalRows = hasTotalRows ? normalizeNonNegativeInteger(totalRows) : null;
  const totalPages = pageSize === "all"
    ? (normalizedTotalRows === null ? 1 : (normalizedTotalRows > 0 ? 1 : 0))
    : (normalizedTotalRows === null ? null : (normalizedTotalRows > 0 ? Math.ceil(normalizedTotalRows / pageSize) : 0));
  const page = pageSize === "all"
    ? 1
    : (totalPages === null || totalPages === 0 ? requestedPage : Math.min(requestedPage, totalPages));
  const limit = pageSize === "all"
    ? Math.max(normalizedTotalRows || 0, 1)
    : pageSize;

  return { page, pageSize, limit, totalPages };
}

function buildShippingDatasetRevision(rows = []) {
  const identities = (Array.isArray(rows) ? rows : [])
    .map((row = {}) => [
      String(row.groupIdentity ?? row.identity ?? "").trim(),
      String(Number(row.shopId || 0)),
      String(Math.max(0, Number(row.totalQuantity || 0))),
      String(Math.max(0, Number(row.orderCount || 0))),
      String(row.datasetUpdatedAt ?? row.updatedAt ?? "").trim(),
    ].join("\u001f"))
    .sort();
  const digest = crypto
    .createHash("sha256")
    .update(`${identities.length}\n${identities.join("\n")}`)
    .digest("hex");
  return `shipping-dataset-v1:${digest}`;
}

function buildShippingDatasetRevisionFromSummary({
  identityFingerprint,
  pendingEntryQuantity,
  aggregateOrderCount,
  totalRows,
  minDatasetUpdatedAt,
  maxDatasetUpdatedAt,
} = {}) {
  return buildShippingDatasetRevision([{
    groupIdentity: String(identityFingerprint || "0"),
    shopId: 0,
    totalQuantity: normalizeNonNegativeInteger(pendingEntryQuantity),
    orderCount: normalizeNonNegativeInteger(aggregateOrderCount),
    datasetUpdatedAt: [
      minDatasetUpdatedAt || "",
      maxDatasetUpdatedAt || "",
      `rows:${normalizeNonNegativeInteger(totalRows)}`,
    ].join("|"),
  }]);
}

function normalizeOptionalQuantity(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeDatasetRevision(value) {
  const revision = String(value ?? "").trim();
  return revision || null;
}

function buildShippingPaginationMetadata({
  page,
  pageSize,
  totalRows,
  currentPageRows,
  pendingEntryQuantity,
  datasetRevision,
} = {}) {
  const request = normalizeShippingPageRequest(
    { page, limit: pageSize },
    totalRows,
    { allowLegacyLimit: true, maxLegacyLimit: Number.MAX_SAFE_INTEGER }
  );
  const normalizedTotalRows = normalizeNonNegativeInteger(totalRows);
  const normalizedCurrentPageRows = normalizeNonNegativeInteger(currentPageRows);
  const normalizedPendingEntryQuantity = normalizeOptionalQuantity(pendingEntryQuantity);
  const normalizedDatasetRevision = normalizeDatasetRevision(datasetRevision);
  const snapshotToken = normalizedDatasetRevision === null
    ? null
    : `shipping-v64:${encodeURIComponent(normalizedDatasetRevision)}:${normalizedTotalRows}:${normalizedPendingEntryQuantity ?? "null"}`;

  return {
    page: request.page,
    pageSize: request.pageSize,
    total: normalizedTotalRows,
    totalPages: request.totalPages,
    totalRows: normalizedTotalRows,
    currentPageRows: normalizedCurrentPageRows,
    pendingEntryQuantity: normalizedPendingEntryQuantity,
    datasetRevision: normalizedDatasetRevision,
    snapshotToken,
  };
}

module.exports = {
  buildShippingDatasetRevision,
  buildShippingDatasetRevisionFromSummary,
  buildShippingPaginationMetadata,
  normalizeShippingPageRequest,
};
