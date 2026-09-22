# An Tín Pharma Website

Website catalogue responsive cho An Tín Pharma.

## Chức năng hiện có
- Responsive desktop / tablet / mobile
- Tìm kiếm theo tên sản phẩm, hoạt chất, quy cách
- Lọc danh mục
- Card sản phẩm
- Nút liên hệ Zalo / Facebook
- Sẵn sàng deploy bằng GitHub Pages

## Cập nhật giá tự động

- Nguồn: [Data sàn](https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit), tab `check`; tiêu đề dòng 2, dữ liệu giá trong A:F.
- Lịch: 10h30 Việt Nam mỗi ngày (cron `30 3 * * *`, UTC), đồng thời chạy khi push lên `main`.
- Chạy ngay: GitHub → Actions → **Update prices and deploy website** → **Run workflow** → nhánh `main`.
- Chỉ ghép chính xác Product ID và `sales_region_code = MIENNAM`; lấy số gốc `retail_price_value × 1000`. Không thêm/xóa sản phẩm hoặc sửa nội dung thuốc.
- Giá thiếu/không hợp lệ/mâu thuẫn dùng “Liên hệ”. Nguồn không đọc được, không có dữ liệu miền Nam hoặc sai tiêu đề thì workflow thất bại và giữ website đã triển khai.
- Giá thay đổi sẽ tạo commit cho `catalogue.js` và cache trong `index.html`. Workflow tự triển khai Pages bằng artifact chỉ chứa file website, kể cả khi commit của bot không kích hoạt lần build mới.
- Xem kết quả và số sản phẩm thay đổi trong Actions → lần chạy → Summary. Kiểm tra cài đặt thông báo GitHub Actions nếu muốn nhận email khi chạy lỗi.

## Xác thực Google

Service account: `antin-price-reader@learned-surge-310713.iam.gserviceaccount.com`.
Sheet cần chia sẻ **Người xem** cho email này. Giữ truy cập chung **Bị hạn chế**.
Workflow dùng provider `projects/793819880924/locations/global/workloadIdentityPools/antin-github/providers/github`, giới hạn repository và nhánh `main` ở phía Google Cloud.
Không cần khóa JSON hoặc GitHub Secret cho Google; token ngắn hạn dùng scope `spreadsheets.readonly`, chỉ truyền vào bước đọc nguồn, không lưu vào file hay artifact.

## Kiểm tra

Yêu cầu Node.js 24, không cần cài thư viện:

```sh
node --test scripts/sync-prices.test.mjs
```

Chạy đồng bộ ngoài GitHub cần biến môi trường `GOOGLE_ACCESS_TOKEN` hợp lệ và lệnh `node scripts/sync-prices.mjs`.
Không đưa token vào mã nguồn hoặc log.

GitHub có thể chạy lịch trễ khi tải cao và tự tắt lịch trong repository công khai sau 60 ngày không có hoạt động. Khi đó vào Actions để bật lại workflow: [quy định lịch chạy](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
