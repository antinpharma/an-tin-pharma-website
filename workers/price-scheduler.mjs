import nodemailer from 'nodemailer';
import {timingSafeEqual} from 'node:crypto';
import {connect as connectTls} from 'node:tls';
import {recipient, runCheck, MAX_DAILY_MAILS} from './price-scheduler-core.mjs';

export async function sendSchedulerMail(mail, password, createTransport = nodemailer.createTransport) {
  const transport = createTransport({host: 'smtp.gmail.com', port: 465, secure: true,
    // Pass the hostname straight to Cloudflare's TLS socket. Nodemailer's DNS-to-IP
    // pre-resolution can produce an address the Workers TCP proxy rejects.
    getSocket(_options, callback) {
      let finished = false;
      const socket = connectTls({host:'smtp.gmail.com', port:465, servername:'smtp.gmail.com'});
      const timer = setTimeout(() => socket.destroy(new Error('SMTP connection timeout')), 15000);
      const done = (error) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        callback(error, error ? undefined : {connection:socket, secured:true});
      };
      socket.once('error',done);
      socket.once('secureConnect',()=>done(null));
    },
    auth: {user: recipient, pass: password.replace(/\s/g, '')},
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false});
  try {
    if (mail === null) { await transport.verify(); return {authenticated:true}; }
    const info = await transport.sendMail({...mail, from: {name: 'An Tín Pharma — Giám sát', address: recipient}});
    return info.accepted?.includes(recipient) === true;
  } catch (error) {
    const allowed = ['EAUTH','ESOCKET','ETIMEDOUT','ECONNECTION','EDNS','EENVELOPE','EMESSAGE'];
    return {accepted:false, failure:allowed.includes(error.code) ? error.code : error.name === 'TypeError' ? 'RUNTIME_TYPE_ERROR' : 'SMTP_UNCONFIRMED',
      diagnostics: ['certificate','timeout','ECONNREFUSED','ECONNRESET','DNS','SNI','network connection','unsupported','not implemented','proxy request failed'].filter(word => String(error.message).toLowerCase().includes(word.toLowerCase()))};
  } finally { transport.close(); }
}

export class PriceScheduler {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    if (request.method === 'GET') {
      const state = await this.ctx.storage.get('state');
      return Response.json({service: 'antin-price-scheduler',
        githubConfigured: Boolean(this.env.GITHUB_SCHEDULER_TOKEN?.trim()),
        emailConfigured: Boolean(this.env.PRICE_REPORT_APP_PASSWORD?.trim()),
        lastCheckAt: state?.lastCheckAt || null, outcome: state?.outcome || 'not_checked',
        lastTrigger: state?.lastTrigger || null, lastCronAt: state?.lastCronAt || null,
        lastDispatchAt: state?.lastDispatchAt || null, publication: state?.publication || null,
        notificationLimit: MAX_DAILY_MAILS, notificationDay: state?.day || null,
        notificationAttempts: Object.keys(state?.mail || {}).length,
        mail: state?.mail || {}}, {headers: {'Cache-Control': 'no-store'}});
    }
    // Persisted lease protects against overlapping Cron invocations and isolate restarts.
    const now = Date.now();
    const acquired = await this.ctx.storage.transaction(async tx => {
      if ((await tx.get('leaseUntil') || 0) > now) return false;
      await tx.put('leaseUntil', now + 5 * 60000);
      return true;
    });
    if (!acquired) return Response.json({outcome: 'check_active'});
    try {
      const params = new URL(request.url).searchParams;
      return Response.json(await runCheck({env: this.env, storage: this.ctx.storage, sendMail: sendSchedulerMail,
        manual: params.get('manual') === '1', forceDispatch: params.get('dispatch') === '1', testMail: params.get('testmail') === '1'}));
    } finally { await this.ctx.storage.delete('leaseUntil'); }
  }
}

const singleton = env => env.SCHEDULER.get(env.SCHEDULER.idFromName('daily-prices'));
export default {
  async scheduled(controller, env) {
    const result = await singleton(env).fetch('https://internal/check', {method: 'POST'});
    const state = await result.json();
    // Fixed outcome labels only; never log response bodies or exception messages with credentials.
    console.log(JSON.stringify({outcome: state.outcome, checkedAt: state.lastCheckAt}));
    if (['missing_github_token', 'github_unavailable_or_denied'].includes(state.outcome)) {
      throw Error('Price scheduler needs attention; inspect /health and configured secrets.');
    }
  },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && ['/admin/check', '/admin/dispatch-check', '/admin/mail-check', '/admin/test-mail'].includes(path)) {
      const expected = env.SCHEDULER_ADMIN_KEY;
      const supplied = request.headers.get('Authorization') || '';
      const wanted = `Bearer ${expected || ''}`;
      if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(wanted) ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(wanted))) return new Response('Unauthorized', {status: 401});
      if (path === '/admin/mail-check') return Response.json(await sendSchedulerMail(null, env.PRICE_REPORT_APP_PASSWORD));
      if (path === '/admin/test-mail') return singleton(env).fetch('https://internal/check?manual=1&testmail=1', {method:'POST'});
      return singleton(env).fetch(`https://internal/check?manual=1&dispatch=${path === '/admin/dispatch-check' ? '1' : '0'}`, {method: 'POST'});
    }
    if (request.method !== 'GET') return new Response('Method not allowed', {status: 405});
    if (!['/', '/health'].includes(path)) return new Response('Not found', {status: 404});
    // Unauthenticated HTTP access is read-only; admin operations require a separate secret.
    return singleton(env).fetch('https://internal/health');
  }
};
