import {appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import nodemailer from 'nodemailer';

const recipient = 'nguyenphuockhaimkn@gmail.com';
const time = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'}) : 'Chưa xác định';

export function makePriceMail({report, syncResult, deployResult, verifyResult, runUrl}) {
  const verified = syncResult === 'success' && deployResult === 'success' && verifyResult === 'success' && report?.status === 'checked';
  const fresh = report?.freshness === 'fresh';
  const outcome = !verified ? 'LỖI / CHƯA XÁC MINH WEBSITE' : !fresh ? 'CẢNH BÁO NGUỒN DỮ LIỆU' : 'ĐÃ KIỂM TRA';
  const lines = [`An Tín Pharma — ${outcome}`, '',
    `Thời điểm kiểm tra: ${time(report?.checkedAt)}`,
    `Thời điểm nguồn Data sàn: ${time(report?.sourceUpdatedAt)}`,
    `Đồng bộ: ${syncResult || 'unknown'}; triển khai: ${deployResult || 'unknown'}; xác minh website: ${verifyResult || 'unknown'}.`];
  if (report?.status === 'checked') lines.push('', `Sản phẩm: ${report.total}; mới: ${report.added}.`,
    `Giá thay đổi: ${report.priceChanged}; trạng thái tồn thay đổi: ${report.stockStatusChanged}.`,
    `Giá cần liên hệ: ${report.contactPrices}; ảnh tải lỗi (giữ ảnh cũ): ${report.imageFailures}.`);
  if (verified) lines.push('', 'Đã đối chiếu catalogue đang phục vụ trên website bằng SHA-256 và thời điểm kiểm tra.');
  else lines.push('', 'Chưa xác nhận website đã nhận dữ liệu lần này. Mở nhật ký bên dưới để kiểm tra; không coi báo cáo này là cập nhật giá thành công.');
  if (!fresh) lines.push('Nguồn cũ hơn 36 giờ, không nhận diện được thời điểm hoặc thời điểm ở tương lai. Cần kiểm tra tab check của Data sàn.');
  lines.push('', 'Website: https://antinpharma.github.io/an-tin-pharma-website/', `Nhật ký: ${runUrl}`,
    '', 'Giá lấy theo Product ID + MIENNAM, hệ số ×1.000. Không đưa số lượng tồn vào báo cáo.');
  return {to: recipient, subject: `[An Tín Pharma] ${outcome} — ${time(report?.checkedAt)}`, text: lines.join('\n')};
}

export async function sendPriceMail(mail, password, createTransport = nodemailer.createTransport) {
  if (!password?.trim()) return {sent: false, reason: 'missing_credentials'};
  const transport = createTransport({host: 'smtp.gmail.com', port: 465, secure: true,
    auth: {user: recipient, pass: password.replace(/\s/g, '')},
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false});
  try {
    const info = await transport.sendMail({...mail, from: {name: 'An Tín Pharma', address: recipient}});
    if (!info.accepted?.includes(recipient)) throw new Error('Recipient not accepted');
    return {sent: true};
  } catch {
    // No raw SMTP errors: they may contain credentials or private server data.
    // Never automatically retry an ambiguous SMTP send (possible duplicate mail).
    throw new Error('Email delivery not confirmed. Check Gmail App Password and GitHub Secrets.');
  } finally { transport.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    let report; try { report = JSON.parse(process.env.SYNC_REPORT || 'null'); } catch {}
    const mail = makePriceMail({report, syncResult: process.env.SYNC_RESULT, deployResult: process.env.DEPLOY_RESULT,
      verifyResult: process.env.VERIFY_RESULT, runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`});
    const result = await sendPriceMail(mail, process.env.PRICE_REPORT_APP_PASSWORD);
    const message = result.sent ? 'Gmail accepted the daily report for delivery.' : '::warning::Daily email NOT enabled: add repository secret PRICE_REPORT_APP_PASSWORD for nguyenphuockhaimkn@gmail.com.';
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${message}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
