// All "calendar day" maths is done in Cameroon time (WAT, UTC+1, no daylight saving)
// so that a contract due "today" is never flagged overdue at 11pm the evening before.
const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Integer index of the Cameroon calendar day containing the instant. */
function dayIndex(date) {
  return Math.floor((new Date(date).getTime() + WAT_OFFSET_MS) / DAY_MS);
}

/** Whole calendar days from a to b (negative if b is before a). */
function daysBetween(a, b) {
  return dayIndex(b) - dayIndex(a);
}

/** Start of a Cameroon calendar day as a UTC Date. */
function startOfDay(date) {
  return new Date(dayIndex(date) * DAY_MS - WAT_OFFSET_MS);
}

function addDays(date, n) {
  return new Date(new Date(date).getTime() + n * DAY_MS);
}

module.exports = { dayIndex, daysBetween, startOfDay, addDays, DAY_MS };
