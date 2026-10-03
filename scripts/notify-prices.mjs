import {appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const time = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'}) : 'Chưa xác định';

export function makePriceReport({report, syncResult, deployResult, verifyResult, runUrl}) {
  const verified = syncResult === 'success' && deployResult === 'success' && verifyResult === 'success' && report?.status === 'checked';
  const day = value => Number.isFinite(Date.parse(value))
    ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0,10) : null;
  const fresh = report?.freshness === 'fresh' && day(report?.checkedAt) !== null
    && day(report?.sourceUpdatedAt) === day(report?.checkedAt);
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
  if (!fresh) lines.push('Chưa xác nhận nguồn của đúng ngày kiểm tra theo giờ Việt Nam: nguồn khác ngày, quá 36 giờ, không nhận diện được thời điểm hoặc ở tương lai. Cần kiểm tra tab check của Data sàn.');
  lines.push('', 'Website: https://antinpharma.github.io/an-tin-pharma-website/', `Nhật ký: ${runUrl}`,
    '', 'Giá nguồn lấy theo Product ID + MIENNAM, hệ số ×1.000. Giá xác nhận riêng chỉ dùng khi thiếu dòng MIENNAM. Không đưa số lượng tồn vào báo cáo.');
  return {subject: `[An Tín Pharma] ${outcome} — ${time(report?.checkedAt)}`, text: lines.join('\n')};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    let report; try { report = JSON.parse(process.env.SYNC_REPORT || 'null'); } catch {}
    const summary = makePriceReport({report, syncResult: process.env.SYNC_RESULT, deployResult: process.env.DEPLOY_RESULT,
      verifyResult: process.env.VERIFY_RESULT, runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`});
    // One persistent scheduler owns all price emails. Pushes, retries and reruns
    // keep their full report here without creating another SMTP sender.
    const message = 'Email thông báo do Cloudflare quản lý: tối đa 2 thư/ngày theo giờ Việt Nam (1 cảnh báo + 1 xác nhận). GitHub chỉ lưu báo cáo lần chạy.';
    console.log(summary.text+'\n\n'+message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${summary.text}\n\n${message}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
