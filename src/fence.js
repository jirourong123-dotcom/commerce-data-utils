function createShippingDatasetFence({ visibilityRevision, dataGeneration } = {}) {
  if (!visibilityRevision || !dataGeneration) {
    throw new TypeError("complete shipping fence required");
  }
  return Object.freeze({
    visibilityRevision: String(visibilityRevision),
    dataGeneration: String(dataGeneration),
  });
}

function isShippingDatasetFenceCompatible(actual, expected) {
  if (!actual || !expected) return false;
  if (!actual.visibilityRevision || !actual.dataGeneration) return false;
  if (!expected.visibilityRevision || !expected.dataGeneration) return false;
  return actual.visibilityRevision === expected.visibilityRevision
    && actual.dataGeneration === expected.dataGeneration;
}

module.exports = {
  createShippingDatasetFence,
  isShippingDatasetFenceCompatible,
};
