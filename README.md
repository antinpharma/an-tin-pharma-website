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
node --test scripts/sync-prices.test.mjs workers/orders.test.mjs
```

Chạy đồng bộ ngoài GitHub cần biến môi trường `GOOGLE_ACCESS_TOKEN` hợp lệ và lệnh `node scripts/sync-prices.mjs`.
Không đưa token vào mã nguồn hoặc log.

GitHub có thể chạy lịch trễ khi tải cao và tự tắt lịch trong repository công khai sau 60 ngày không có hoạt động. Khi đó vào Actions để bật lại workflow: [quy định lịch chạy](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Giỏ hàng và gửi yêu cầu qua Zalo Bot

Giỏ hàng lưu sản phẩm trên trình duyệt. Khách có thể chọn/bỏ chọn, tăng giảm số lượng, xóa hàng, sao chép danh sách rồi mở Zalo. Tên và số điện thoại trong biểu mẫu gửi trực tiếp không được lưu vào localStorage/sessionStorage.

`workers/orders.mjs` nhận yêu cầu gửi trực tiếp tại `/orders` và gửi thông báo qua bot An Tín tới tài khoản Zalo đã ghép. Website chỉ hiển thị biểu mẫu khi `ORDER_API_URL` trong `config.js` có giá trị. Giữ trống cấu hình này cho đến khi kết nối và tài khoản nhận đơn đã được kiểm tra.

### Thiết lập và triển khai Worker

1. Dùng Cloudflare Workers Free và SQLite Durable Object; cấu hình trong `workers/wrangler.jsonc`. Không cần tên miền riêng. Kiểm tra hạn mức hiện hành tại [Cloudflare](https://developers.cloudflare.com/workers/platform/pricing/); hạn mức Zalo do Zalo quy định riêng.
2. Đăng nhập Wrangler với quyền cập nhật Worker rồi chạy `npx wrangler deploy --config workers/wrangler.jsonc`.
3. Lưu `ZALO_BOT_TOKEN` và một mã quản trị ngẫu nhiên `ZALO_SETUP_KEY` dưới dạng **Secret** trong Cloudflare. Lấy Bot Token từ tin nhắn Zalo Bot Manager, không dùng đường dẫn mở bot. Không đặt các giá trị này trong `config.js`, GitHub hoặc ảnh chụp màn hình.
4. Lưu riêng mã quản trị cùng giá trị vào `.env.zalo-admin.local` (đã được gitignore): `ZALO_SETUP_KEY=<giá trị riêng>`. Chạy `node --env-file=.env.zalo-admin.local workers/admin.mjs check`. Phải xác nhận đúng bot ID `576169620734670481`.
5. Tạo mã xác minh mới bằng `node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log('ANTIN-'+randomBytes(12).toString('hex').toUpperCase())"`. Chủ website gửi đúng mã này trong tin nhắn riêng tới [bot An Tín](https://bot.zaloplatforms.com/bots/576169620734670481). Chạy `node --env-file=.env.zalo-admin.local workers/admin.mjs pair ANTIN-<mã vừa tạo>` để ghép tài khoản. Bot không được có webhook khác đang hoạt động khi ghép bằng getUpdates. Kiểm tra lại phải trả về `paired: true`. Không tự động ghép lại sang tài khoản khác.
6. Sau khi kiểm tra nhận thông báo thử, đặt `ORDER_API_URL` thành `https://antin-orders.minhtran123hehe.workers.dev/orders`, cập nhật phiên bản cache của `config.js` trong `index.html`, rồi triển khai website qua nhánh `main`. Triển khai GitHub Pages không tự triển khai Worker.

### Cách xử lý yêu cầu

- Worker tự đọc catalogue đã xuất bản và tính giá; không tin giá, nội dung thông báo hoặc người nhận do trình duyệt gửi lên. Giá chưa xác định giữ “Liên hệ”. Đây là yêu cầu liên hệ xác nhận hàng, chưa phải thanh toán hoặc xác nhận đơn bán.
- Cùng một mã yêu cầu và nội dung được chống gửi trùng trong 30 ngày. Khi phản hồi Zalo không rõ ràng, website báo chưa xác nhận; khách liên hệ kèm mã yêu cầu để kiểm tra, không tự gửi lại thông báo có thể đã được nhận.
- Tối đa 3 yêu cầu mới/phút/địa chỉ IP và 2 tin nhắn Zalo/yêu cầu; danh sách quá dài cần chia nhỏ. Kiểm tra Origin và giới hạn IP chỉ giảm gửi nhầm/spam cơ bản, không thay thế cơ chế xác thực khách hàng.
- Durable Object lưu tài khoản nhận, mã băm nội dung và trạng thái gửi; không lưu tên, số điện thoại hoặc nội dung đơn. Thông báo có các thông tin khách cung cấp được chuyển tới Zalo. Log Worker mặc định tắt.
- Khi cần tạm ngừng, để trống `ORDER_API_URL` rồi triển khai lại website; khách vẫn sử dụng chức năng sao chép và mở Zalo.
