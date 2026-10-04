export function dailySyncStart(now = new Date()) {
  const localDay = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0,10);
  return Date.parse(localDay + 'T04:17:00.000Z'); // 11:17 Vietnam.
}

export function hasDailySync(status, now = new Date()) {
  const checked = Date.parse(status?.checkedAt);
  return status?.status === 'checked' && Number.isFinite(checked) &&
    checked >= dailySyncStart(now) && checked <= now.getTime();
}
