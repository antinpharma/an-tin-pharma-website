import {createHash} from 'node:crypto';

const site = 'https://antinpharma.github.io/an-tin-pharma-website/';
const workflow = 'https://api.github.com/repos/antinpharma/an-tin-pharma-website/actions/workflows/daily-prices.yml';
export const recipient = 'nguyenphuockhaimkn@gmail.com';
export const MAX_DAILY_MAILS = 2;
const day = value => Number.isFinite(Date.parse(value))
  ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 10) : null;

export function inWindow(now) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return minute >= 11 * 60 + 17 && minute < 19 * 60;
}

export async function inspectPublication(now, fetchImpl = fetch) {
  const nonce = now.getTime();
  const get = async file => {
    const response = await fetchImpl(`${site}${file}?watchdog=${nonce}`, {
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Error('publication_unavailable');
    return response;
  };
  const status = await (await get('data/catalogue-status.json')).json();
  const today = day(now.toISOString());
  if (status?.status !== 'checked' || status.freshness !== 'fresh' ||
      day(status.checkedAt) !== today || day(status.sourceUpdatedAt) !== today ||
      Date.parse(status.checkedAt) > now.getTime() ||
      Date.parse(status.sourceUpdatedAt) > Date.parse(status.checkedAt) ||
      !/^[a-f0-9]{64}$/.test(status.catalogueSha256 || '')) return {verified: false};
  const [catalogue, home] = await Promise.all([
    get('catalogue.js').then(r => r.text()), get('index.html').then(r => r.text())
  ]);
  if (createHash('sha256').update(catalogue).digest('hex') !== status.catalogueSha256 ||
      !home.includes(`catalogue.js?v=${status.catalogueSha256.slice(0, 12)}`)) return {verified: false};
  return {verified: true, checkedAt: status.checkedAt, sourceUpdatedAt: status.sourceUpdatedAt};
}

export async function runCheck({env, storage, now = new Date(), fetchImpl = fetch, sendMail, manual = false, forceDispatch = false, testMail = false}) {
  if (!manual && !inWindow(now)) return {outcome: 'outside_window'};
  const today = day(now.toISOString());
  const previous = await storage.get('state');
  const state = previous?.day === today ? {...previous} : {day: today, attempts: 0, mail: {}};
  state.lastCheckAt = now.toISOString();
  state.lastTrigger = manual ? 'manual' : 'cron';
  if (!manual) state.lastCronAt = now.toISOString();
  state.githubConfigured = Boolean(env.GITHUB_SCHEDULER_TOKEN?.trim());
  state.emailConfigured = Boolean(env.PRICE_REPORT_APP_PASSWORD?.trim());
  let publication;
  try { publication = await inspectPublication(now, fetchImpl); }
  catch { publication = {verified: false}; }
  state.publication = publication;
  state.outcome = publication.verified ? 'verified' : 'awaiting_update';
  if (!publication.verified || forceDispatch) {
    if (!state.githubConfigured) state.outcome = 'missing_github_token';
    else {
      const headers = {Authorization: `Bearer ${env.GITHUB_SCHEDULER_TOKEN.trim()}`,
        Accept: 'application/vnd.github+json', 'User-Agent': 'antin-price-scheduler',
        'X-GitHub-Api-Version': '2022-11-28'};
      try {
        // Fail closed when the run list is unavailable; never blindly create another run.
        const response = await fetchImpl(`${workflow}/runs?branch=main&per_page=30`, {
          headers, redirect: 'manual', signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) { state.githubHttpStatus = response.status; throw Error(); }
        const result = await response.json();
        if (!Array.isArray(result.workflow_runs)) throw Error();
        const active = result.workflow_runs.find(run => run.head_branch === 'main' && run.status !== 'completed');
        const cooldown = (state.attempts >= 3 ? 30 : 10) * 60000;
        if (active) {
          state.outcome = 'workflow_active';
          state.activeRunId = active.id;
        } else if (state.lastAttemptAt && now.getTime() - Date.parse(state.lastAttemptAt) < cooldown) {
          state.outcome = 'retry_cooldown';
        } else {
          // Persist BEFORE POST: an ambiguous response must not cause an immediate duplicate.
          state.lastAttemptAt = now.toISOString();
          state.attempts++;
          state.outcome = 'dispatch_pending';
          await storage.put('state', state);
          const dispatched = await fetchImpl(`${workflow}/dispatches`, {method: 'POST',
            headers: {...headers, 'Content-Type': 'application/json'},
            body: JSON.stringify({ref: 'main'}), redirect: 'manual', signal: AbortSignal.timeout(12000)});
          state.githubHttpStatus = dispatched.status;
          if (dispatched.status !== 204) throw Error();
          state.outcome = 'dispatch_accepted';
          state.lastDispatchAt = now.toISOString();
        }
      } catch { state.outcome = 'github_unavailable_or_denied'; }
    }
  }
  const localHour = new Date(now.getTime() + 7 * 3600000).getUTCHours();
  const kind = manual && testMail ? 'test' : publication.verified ? 'verified' : localHour >= 12 ? 'warning' : null;
  if (kind && state.emailConfigured && !state.mail[kind] && Object.keys(state.mail).length < MAX_DAILY_MAILS) {
    // Count every reserved attempt, including admin tests and unconfirmed SMTP.
    // Reservations survive retries, deployments and restarts; never send a third mail.
    state.mail[kind] = {at: now.toISOString(), outcome: 'pending'};
    await storage.put('state', state);
    const format = value => new Date(value).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'});
    const subject = `[An Tín Pharma] ${kind === 'test' ? 'KIỂM TRA BỘ HẸN GIỜ' : kind === 'verified' ? 'GIÁM SÁT: ĐÃ XÁC MINH WEBSITE' : 'CẢNH BÁO: CHƯA CẬP NHẬT HÔM NAY'} — ${today}`;
    const text = [`Kiểm tra độc lập từ Cloudflare: ${format(now.toISOString())}.`,
      publication.verified
        ? `Đã đối chiếu catalogue, phiên bản trang và ngày nguồn. Nguồn: ${format(publication.sourceUpdatedAt)}; đồng bộ: ${format(publication.checkedAt)}.`
        : 'Chưa xác minh được website đã nhận nguồn của hôm nay. Bộ hẹn giờ tiếp tục kiểm tra trong khung 11:17–18:57; kiểm tra quyền GitHub, nguồn Sheet và nhật ký nếu tình trạng kéo dài.',
      `Trạng thái kiểm tra: ${state.outcome}.`, `Website: ${site}`,
      'Nhật ký GitHub: https://github.com/antinpharma/an-tin-pharma-website/actions/workflows/daily-prices.yml',
      'Đây là thư giám sát gửi trực tiếp từ Cloudflare, độc lập với email báo cáo của GitHub.'
    ].join('\n\n');
    try {
      const accepted = await sendMail({to: recipient, subject, text}, env.PRICE_REPORT_APP_PASSWORD);
      state.mail[kind].outcome = accepted === true || accepted?.accepted === true ? 'smtp_accepted' : 'unconfirmed';
      if (['EAUTH','ESOCKET','ETIMEDOUT','ECONNECTION','EDNS','EENVELOPE','EMESSAGE','RUNTIME_TYPE_ERROR','SMTP_UNCONFIRMED'].includes(accepted?.failure)) {
        state.mail[kind].failure = accepted.failure;
      }
    } catch { state.mail[kind].outcome = 'unconfirmed'; }
  }
  await storage.put('state', state);
  return state;
}
