import nodemailer from 'nodemailer';
import {recipient, runCheck} from './price-scheduler-core.mjs';

export async function sendSchedulerMail(mail, password, createTransport = nodemailer.createTransport) {
  const transport = createTransport({host: 'smtp.gmail.com', port: 465, secure: true,
    auth: {user: recipient, pass: password.replace(/\s/g, '')},
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false});
  try {
    const info = await transport.sendMail({...mail, from: {name: 'An Tín Pharma — Giám sát', address: recipient}});
    return info.accepted?.includes(recipient) === true;
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
        lastDispatchAt: state?.lastDispatchAt || null, publication: state?.publication || null,
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
      return Response.json(await runCheck({env: this.env, storage: this.ctx.storage, sendMail: sendSchedulerMail}));
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
    if (request.method !== 'GET') return new Response('Method not allowed', {status: 405});
    if (!['/', '/health'].includes(new URL(request.url).pathname)) return new Response('Not found', {status: 404});
    // Public HTTP access is read-only. Only Cloudflare Cron can dispatch or email.
    return singleton(env).fetch('https://internal/health');
  }
};
