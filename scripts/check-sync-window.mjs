import {readFile, appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function syncDue(status, {event, schedule, now = new Date()}) {
  if (event !== 'schedule' || schedule !== '47 8 * * *') return true;
  if (status?.status !== 'checked' || status.freshness !== 'fresh') return true;
  const checked = Date.parse(status.checkedAt), source = Date.parse(status.sourceUpdatedAt);
  const localDay = date => new Date(date + 7 * 3600000).toISOString().slice(0, 10);
  if (!Number.isFinite(checked) || !Number.isFinite(source)) return true;
  return checked > now.getTime() || source > now.getTime() + 3600000 ||
    localDay(checked) !== localDay(now.getTime()) || now - source > 36 * 3600000;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let status;
  try {
    const response = await fetch(`https://antinpharma.github.io/an-tin-pharma-website/data/catalogue-status.json?t=${Date.now()}`,
      {cache: 'no-store', signal: AbortSignal.timeout(15000)});
    if (response.ok) status = await response.json();
    // Only trust the deployed status if its catalogue identity also matches the repo.
    const local = JSON.parse(await readFile('data/catalogue-status.json', 'utf8'));
    if (local.catalogueSha256 !== status?.catalogueSha256 || local.checkedAt !== status?.checkedAt) status = null;
  } catch { status = null; }
  const due = syncDue(status, {event: process.env.GITHUB_EVENT_NAME, schedule: process.env.SYNC_SCHEDULE});
  await appendFile(process.env.GITHUB_OUTPUT, `due=${due}\n`);
  console.log(due ? 'Sync required.' : 'Backup schedule skipped: fresh source already checked and deployed today.');
}
