const BUSINESS_TIME_ZONE = "Asia/Shanghai";
const SHANGHAI_BUSINESS_DATE_SQL = "DATE(CONVERT_TZ(UTC_TIMESTAMP(3), '+00:00', '+08:00'))";

function getShanghaiBusinessDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid business date");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

module.exports = {
  BUSINESS_TIME_ZONE,
  SHANGHAI_BUSINESS_DATE_SQL,
  getShanghaiBusinessDate,
};
