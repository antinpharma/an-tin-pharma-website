# An Tín Pharma Website

## Project purpose
Website catalogue công khai của An Tín Pharma.
Khách hàng xem sản phẩm, giá, hoạt chất, chỉ định và liên hệ qua Zalo/Facebook.

## Deployment
- Repository: minhtran123hehe-png/an-tin-pharma-website
- Branch production: main
- Hosting: GitHub Pages
- Workflow `.github/workflows/daily-prices.yml` cập nhật giá và triển khai GitHub Pages khi push lên main, chạy thủ công hoặc theo lịch 10h30 Việt Nam mỗi ngày (03:30 UTC).

## Product workflow
1. Ảnh sản phẩm được upload vào Google Drive.
2. Tên file ảnh được dùng để nhận diện sản phẩm.
3. Nếu sản phẩm đã có dữ liệu catalogue:
   - KHÔNG query lại web.
   - Đồng bộ các ô dữ liệu được điền trong Data sàn; ô trống giữ thông tin cũ và ảnh cũ theo Product ID.
4. Nếu sản phẩm mới:
   - Thêm từ dòng MIENNAM trong Data sàn. Thông tin còn thiếu hiển thị "Đang cập nhật", không tự đoán hoặc tra lại hàng loạt ngoài yêu cầu.
5. Danh mục và giá lấy từ Google Sheet "Data sàn": https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit
   - Tab `check`: dòng 1 là thời điểm cập nhật, dòng 2 là tiêu đề cột.
   - Đọc bằng tài khoản được cấp quyền; không yêu cầu công khai bảng nguồn.
   - Ghép chính xác `product_id` với Product ID trong catalogue, đọc giá dạng số gốc (UNFORMATTED_VALUE).
   - Đồng bộ product_name, brand, product_category, Hoạt chất, Chỉ định và Quy cách nếu có. Không đưa cột Check tồn lên website; không thay ảnh từ cột Ảnh.
   - `scripts/sync-prices.mjs` đọc nguồn qua Google Sheets API và cập nhật `catalogue.js`; trình duyệt dùng catalogue đã mirror.
   - Workflow dùng Workload Identity Federation với service account `antin-price-reader@learned-surge-310713.iam.gserviceaccount.com`, scope chỉ đọc Sheets; không dùng khóa JSON.
   - Khi danh mục/giá thay đổi, tự commit `catalogue.js` và phiên bản cache trong `index.html`, rồi triển khai Pages ngay trong workflow. Không tự xóa sản phẩm cũ khi vắng trong nguồn.
   - Lỗi truy cập/API hoặc sai cấu trúc nguồn: dừng, không ghi catalogue. Giá thiếu, không hợp lệ hoặc trùng ID miền Nam có giá khác nhau: dùng "Liên hệ".
6. Chỉ dùng sales_region_code = MIENNAM.
7. retail_price_value đã là đồng, lấy nguyên giá (PRICE_MULTIPLIER = 1). Người dùng xác nhận đổi quy ước ngày 23/09/2026; không nhân 1000 nữa.
8. Nếu không chắc giá, dùng "Liên hệ", không đoán.
9. Ảnh public của website được mirror vào repository GitHub.

## Important files
- index.html: cấu trúc trang
- style.css: giao diện
- app.js: logic website
- config.js: Facebook, Zalo và cấu hình
- catalogue.js: dữ liệu catalogue public
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
