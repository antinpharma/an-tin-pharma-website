# An Tín Pharma Website

## Project purpose
Website catalogue công khai của An Tín Pharma.
Khách hàng xem sản phẩm, giá, hoạt chất, chỉ định và liên hệ qua Zalo/Facebook.

## Deployment
- Repository: antinpharma/an-tin-pharma-website
- Website: https://antinpharma.github.io/an-tin-pharma-website/
- Branch production: main
- Hosting: GitHub Pages
- Workflow `.github/workflows/daily-prices.yml` đồng bộ khi push lên main, chạy thủ công hoặc lúc 11:17 hằng ngày theo giờ Việt Nam (cron `17 4 * * *`). Lịch dự phòng 11:47, 12:17 và 15:47 (cron `47 4 * * *`, `17 5 * * *`, `47 8 * * *`) chỉ bỏ qua khi cả ngày nguồn và ngày kiểm tra đều là hôm nay theo giờ Việt Nam, đồng thời xác minh catalogue đã xuất bản. Nguồn hôm trước dù chưa quá 36 giờ vẫn chạy lại và báo cảnh báo email. GitHub có thể trễ hoặc bỏ lượt; không cam kết chính xác theo phút.
- Mỗi lượt đồng bộ thành công ghi `data/catalogue-status.json` với thời điểm kiểm tra, thời điểm nguồn, số thay đổi và SHA-256 catalogue (không ghi số lượng tồn). Triển khai cả dấu thời gian này khi giá không đổi; lỗi đọc nguồn không cập nhật dấu thời gian. Sau Pages, kiểm tra catalogue/index/status đang phục vụ khớp lần chạy.
- Người dùng xác nhận ngày 03/10/2026: email giá tối đa 2 lần/ngày theo giờ Việt Nam, gồm tối đa 1 cảnh báo và 1 xác nhận. Chỉ Worker `antin-price-scheduler` gửi email tới `nguyenphuockhaimkn@gmail.com`, dùng Cloudflare Secret `PRICE_REPORT_APP_PASSWORD`; GitHub job `notify` chỉ lưu báo cáo vào Actions Summary, không gửi SMTP sau mỗi push/lượt retry. Chưa có secret thì không báo đã gửi. Email lỗi không được làm mất catalogue đã triển khai.

## Independent scheduler
- Worker riêng `antin-price-scheduler`, cấu hình `workers/wrangler-price-scheduler.jsonc`; không sửa Worker đặt hàng để hẹn giờ giá. Kiểm tra mỗi 10 phút 11:17–18:57 giờ Việt Nam; SHA-256 catalogue + index + ngày nguồn/ngày kiểm tra phải khớp trước khi bỏ qua.
- Secret Cloudflare `GITHUB_SCHEDULER_TOKEN`: fine-grained token chỉ Actions read/write trên repo này. `PRICE_REPORT_APP_PASSWORD`: Gmail app password cho đường cảnh báo độc lập. Không đọc ngược GitHub Secrets hoặc chép credential GitHub rộng sang Cloudflare. Chưa kiểm thử credential thực tế thì không báo đã kích hoạt đầy đủ.
- Dùng Durable Object lưu lease và cooldown; không gọi thêm nếu workflow main đang chờ/đang chạy. Sau 3 lần thử, giãn gọi lại từ 10 lên 30 phút. Từ 12h gửi cảnh báo khi chưa xác minh; email tối đa một lần thử mỗi loại/ngày và tối đa 2 lần thử tổng/ngày, kể cả admin test và SMTP không rõ kết quả; không tự retry SMTP. Giữ trạng thái đã gửi qua deploy/restart, reset theo ngày Việt Nam. `/health` chỉ đọc, không chứa bí mật, hiển thị hạn mức email. Kiểm thử `workers/price-scheduler.test.mjs`.

## Product workflow
1. Ảnh sản phẩm được upload vào Google Drive.
2. Tên file ảnh được dùng để nhận diện sản phẩm.
3. Nếu sản phẩm đã có dữ liệu catalogue:
   - KHÔNG query lại web.
   - Đồng bộ A:G từ Data sàn; H:I:J chỉ từ backup. Ghép theo Product ID + MIENNAM, không theo số dòng. Ô trống giữ thông tin cũ và ảnh cũ.
4. Nếu sản phẩm mới:
   - Thêm từ dòng MIENNAM trong Data sàn. Thông tin còn thiếu hiển thị "Đang cập nhật", không tự đoán hoặc tra lại hàng loạt ngoài yêu cầu.
5. Danh mục và giá lấy từ Google Sheet "Data sàn": https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit
   - Tab `check`: dòng 1 là thời điểm cập nhật, dòng 2 là tiêu đề cột.
   - Đọc bằng tài khoản được cấp quyền; không yêu cầu công khai bảng nguồn.
   - Ghép chính xác `product_id` với Product ID trong catalogue, đọc giá dạng số gốc (UNFORMATTED_VALUE).
   - Chỉ đọc A:G. Đồng bộ product_name, brand, product_category và giá; cột G Tồn khả dụng chỉ xuất trạng thái Hết hàng khi bằng 0, không xuất số lượng tồn. Sản phẩm hết hàng không thêm vào giỏ hoặc gửi đơn, vẫn liên hệ Zalo được; ô tồn thiếu/sai/mâu thuẫn là trạng thái chưa xác định. Không đọc H:I:J trong file này vì có thể lệch dòng sau cập nhật hệ thống.
   - Hoạt chất, Chỉ định, link ảnh URL lấy từ backup: https://docs.google.com/spreadsheets/d/1AlreWSLbHiXHGP9BqdMH1WC_wVyEbV3pRREXVuD3r9k/edit ; tab `Sheet1`, tiêu đề dòng 1. Chỉ dùng Product ID + sales_region_code để ghép H:I:J; không dùng tên, giá, tồn kho trong backup.
   - Mọi lần tra cứu bổ sung sau này điền H:I trong backup, chỉ điền ô trống của đúng Product ID miền Nam. Người dùng cập nhật ảnh ở J trong backup. Không sắp xếp riêng H:I:J; phải giữ cả dòng A:J gắn với Product ID.
   - Tải URL ảnh trong backup về `images/sheet`. URL trống hoặc tải lỗi giữ ảnh cũ. Hiện hỗ trợ CDN `cdn-gcs.thuocsi.vn`; không xóa ảnh cũ. Giữ quy cách cũ trong catalogue.
   - `scripts/sync-prices.mjs` đọc nguồn qua Google Sheets API và cập nhật `catalogue.js`; trình duyệt dùng catalogue đã mirror.
   - Workflow dùng Workload Identity Federation với service account `antin-price-reader@learned-surge-310713.iam.gserviceaccount.com`, scope chỉ đọc Sheets; cần quyền Người xem trên cả hai file, không dùng khóa JSON.
   - Khi danh mục/giá thay đổi, tự commit `catalogue.js` và phiên bản cache trong `index.html`, rồi triển khai Pages ngay trong workflow. Không tự xóa sản phẩm cũ khi vắng trong nguồn.
   - Lỗi truy cập/API hoặc sai cấu trúc nguồn: dừng, không ghi catalogue. Giá thiếu, không hợp lệ hoặc trùng ID miền Nam có giá khác nhau: dùng "Liên hệ".
6. Chỉ dùng sales_region_code = MIENNAM.
7. Nguồn Data sàn cập nhật lại dùng nghìn đồng: PRICE_MULTIPLIER = 1000. Người dùng xác nhận ngày 24/09/2026: 113 → 113.000đ, 322 → 322.000đ. Quy ước này thay thế xác nhận ngày 23/09. Không tự suy đoán hệ số khi nguồn đổi; kiểm tra chặn thay đổi giá hàng loạt 1.000 lần trước khi xuất bản.
8. Nếu không chắc giá, dùng "Liên hệ", không đoán.
   - Ngoại lệ được người dùng xác nhận ngày 30/09/2026: Candid cream Glenmark 20g, Product ID 2986, giá bán 21.100đ. Lưu ở `config.js` → `PRICE_FALLBACKS_VND` (đơn vị đồng), chỉ áp dụng khi nguồn thiếu dòng MIENNAM. Nếu có dòng MIENNAM thì dùng giá nguồn; giá nguồn sai hoặc mâu thuẫn vẫn là "Liên hệ". Không tự thêm ngoại lệ hoặc lấy giá miền Bắc cho sản phẩm khác.
9. Ảnh public của website được mirror vào repository GitHub.

## Important files
- index.html: cấu trúc trang
- style.css: giao diện
- app.js: logic website
- config.js: Facebook, Zalo và cấu hình
- catalogue.js: dữ liệu catalogue public
- product-groups.js: nhóm duyệt sản phẩm theo Product ID, độc lập với product_category trong Sheet; mã chưa được rà soát vào “Chưa phân nhóm”. Khi thêm nhóm mới, cập nhật kiểm thử scripts/product-groups.test.mjs.
- product-departments.js: gợi ý duyệt theo khoa, cho phép một Product ID ở nhiều khoa; dùng nhóm đã rà soát và danh sách ID được đối chiếu với catalogue. Không suy ra dùng cho trẻ em/phụ nữ mang thai từ tên, dạng bào chế hoặc từ khóa. Kiểm thử cùng scripts/product-groups.test.mjs; thêm file này vào gói GitHub Pages. Nhóm và khoa nằm dưới danh sách sản phẩm, có liên kết nhảy nhanh ở đầu.
- images/: ảnh sản phẩm public

## Contact
- Zalo: 0905561550
- Facebook: https://www.facebook.com/profile.php?id=61594629503087

## Rules for Codex
- Không xóa dữ liệu sản phẩm đang hoạt động nếu không được yêu cầu.
- Không thay đổi Product ID tùy ý.
- Không query lại thông tin thuốc nếu sản phẩm đã có data đầy đủ.
- Không tự bịa chỉ định, hoạt chất, quy cách hoặc giá.
- Trước khi sửa lớn, giải thích ngắn các file sẽ thay đổi.
- Giữ website responsive trên desktop và mobile.
- Không làm hỏng GitHub Pages.
- Sau khi sửa, kiểm tra lỗi JavaScript và đường dẫn file.
- Không commit secret, password, API key hoặc token vào GitHub.
