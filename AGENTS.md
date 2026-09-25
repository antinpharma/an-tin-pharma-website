# An Tín Pharma Website

## Project purpose
Website catalogue công khai của An Tín Pharma.
Khách hàng xem sản phẩm, giá, hoạt chất, chỉ định và liên hệ qua Zalo/Facebook.

## Deployment
- Repository: antinpharma/an-tin-pharma-website
- Website: https://antinpharma.github.io/an-tin-pharma-website/
- Branch production: main
- Hosting: GitHub Pages
- Workflow `.github/workflows/daily-prices.yml` đồng bộ khi push lên main, chạy thủ công hoặc mỗi 15 phút (phút 07, 22, 37, 52 mỗi giờ). Lịch GitHub có thể trễ; chỉ triển khai lại theo lịch khi dữ liệu thay đổi.

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
9. Ảnh public của website được mirror vào repository GitHub.

## Important files
- index.html: cấu trúc trang
- style.css: giao diện
- app.js: logic website
- config.js: Facebook, Zalo và cấu hình
- catalogue.js: dữ liệu catalogue public
- product-groups.js: nhóm duyệt sản phẩm theo Product ID, độc lập với product_category trong Sheet; mã chưa được rà soát vào “Chưa phân nhóm”. Khi thêm nhóm mới, cập nhật kiểm thử scripts/product-groups.test.mjs.
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
