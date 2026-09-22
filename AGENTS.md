# An Tín Pharma Website

## Project purpose
Website catalogue công khai của An Tín Pharma.
Khách hàng xem sản phẩm, giá, hoạt chất, chỉ định và liên hệ qua Zalo/Facebook.

## Deployment
- Repository: minhtran123hehe-png/an-tin-pharma-website
- Branch production: main
- Hosting: GitHub Pages
- Mỗi lần push lên main, GitHub Pages sẽ deploy website.

## Product workflow
1. Ảnh sản phẩm được upload vào Google Drive.
2. Tên file ảnh được dùng để nhận diện sản phẩm.
3. Nếu sản phẩm đã có dữ liệu catalogue:
   - KHÔNG query lại web.
   - Chỉ cập nhật giá.
4. Nếu sản phẩm mới:
   - Tìm tên chuẩn, hoạt chất, quy cách, brand và chỉ định.
5. Giá lấy từ file Check Daily.
6. Chỉ dùng sales_region_code = MIENNAM.
7. retail_price_value x 1000 = giá hiển thị website.
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