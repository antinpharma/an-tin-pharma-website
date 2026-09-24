# An Tín Pharma Website

Website catalogue responsive cho An Tín Pharma.

## Chức năng hiện có
- Responsive desktop / tablet / mobile
- Tìm kiếm theo tên sản phẩm, hoạt chất, quy cách
- Lọc danh mục
- Card sản phẩm
- Nút liên hệ Zalo / Facebook
- Sẵn sàng deploy bằng GitHub Pages

## Đồng bộ danh mục và giá tự động

- [Data sàn](https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit), tab `check`, tiêu đề dòng 2: chỉ đọc A:G để lấy mã, miền, tên, hãng, danh mục và giá. Không xuất `Check tồn` lên website.
- [Data sàn backup 1](https://docs.google.com/spreadsheets/d/1AlreWSLbHiXHGP9BqdMH1WC_wVyEbV3pRREXVuD3r9k/edit), tab `Sheet1`, tiêu đề dòng 1: đọc A:J nhưng chỉ dùng Product ID + miền để ghép H `Hoạt chất`, I `Chỉ định`, J `link ảnh URL`. Bỏ qua tên, giá và tồn kho cũ trong backup. Tuyệt đối không dùng H:J của Data sàn vì thứ tự dòng có thể thay đổi.
- Lịch: mỗi 15 phút (phút 07, 22, 37, 52 mỗi giờ), đồng thời chạy khi push lên `main`. Đây là đồng bộ định kỳ, không phải thời gian thực từng giây; GitHub có thể chạy trễ. Lần chạy theo lịch không có thay đổi sẽ bỏ qua triển khai Pages.
- Chạy ngay: GitHub → Actions → **Update prices and deploy website** → **Run workflow** → nhánh `main`.
- Chỉ ghép chính xác Product ID và `sales_region_code = MIENNAM`; nguồn mới trả giá theo nghìn đồng, nhân 1.000 (người dùng xác nhận lại ngày 24/09/2026): 113 → 113.000đ, 322 → 322.000đ. Nếu phần lớn giá đột ngột tăng/giảm khoảng 1.000 lần, dừng đồng bộ và xác nhận lại hệ số, không tự đoán.
- Dòng MIENNAM mới trong Data sàn tự thêm sản phẩm. Đồng bộ tên (`product_name`), hãng (`brand`), nhóm (`product_category`) từ Data sàn; hoạt chất, chỉ định từ backup. Ô trống hoặc không có mã trong backup giữ thông tin cũ; sản phẩm mới thiếu thông tin hiển thị “Đang cập nhật”. Giữ quy cách hiện có. Không đoán dữ liệu thuốc.
- Ảnh từ J trong backup được tải về `images/sheet` rồi ghép theo đúng Product ID miền Nam. Hiện hỗ trợ CDN `cdn-gcs.thuocsi.vn`. URL trống hoặc tải lỗi giữ ảnh cũ; không xóa ảnh cũ. Sản phẩm chưa có ảnh dùng ô “Ảnh sản phẩm”. Không tự xóa sản phẩm khi vắng trong nguồn; mã chỉ có trong backup chưa tự tạo sản phẩm bán mới.
- Khi bổ sung nội dung: tìm Product ID ở backup rồi điền H:I:J trên cùng dòng. Có thể sắp xếp **toàn bộ A:J**, không sắp xếp riêng H:I:J. Không cần giữ thứ tự dòng giữa hai file giống nhau. Nếu mã miền Nam bị trùng nhưng nội dung khác nhau, dừng đồng bộ để tránh gán nhầm.
- Giá thiếu/không hợp lệ/mâu thuẫn dùng “Liên hệ”. Nguồn không đọc được, không có dữ liệu miền Nam hoặc sai tiêu đề thì workflow thất bại và giữ website đã triển khai.
- Danh mục hoặc giá thay đổi sẽ tạo commit cho `catalogue.js` và cache trong `index.html`. Trình duyệt chỉ đọc catalogue đã xuất bản; không đọc CSV công khai hoặc quay về Sheet `San pham` cũ. Workflow tự triển khai Pages bằng artifact chỉ chứa file website, kể cả khi commit của bot không kích hoạt lần build mới.
- Xem kết quả và số sản phẩm thay đổi trong Actions → lần chạy → Summary. Kiểm tra cài đặt thông báo GitHub Actions nếu muốn nhận email khi chạy lỗi.

## Xác thực Google

Service account: `antin-price-reader@learned-surge-310713.iam.gserviceaccount.com`.
Cả hai Sheet cần chia sẻ **Người xem** cho email này. Giữ truy cập chung **Bị hạn chế**.
Workflow dùng provider `projects/793819880924/locations/global/workloadIdentityPools/antin-github/providers/github`, giới hạn repository và nhánh `main` ở phía Google Cloud.
Không cần khóa JSON hoặc GitHub Secret cho Google; token ngắn hạn dùng scope `spreadsheets.readonly`, chỉ truyền vào bước đọc nguồn, không lưu vào file hay artifact.

## Kiểm tra

Yêu cầu Node.js 24. Cài thư viện băm mật khẩu đã khóa phiên bản rồi chạy kiểm tra:

```sh
npm ci --ignore-scripts
npm test
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
3. Lưu `ZALO_BOT_TOKEN` và một mã quản trị ngẫu nhiên `ZALO_SETUP_KEY` dưới dạng **Secret** trong Cloudflare. Với bot An Tín hiện tại, lấy Bot Token trong cuộc trò chuyện Bot An Tín; không dùng đường dẫn mở bot. Không đặt các giá trị này trong `config.js`, GitHub hoặc ảnh chụp màn hình.
4. Lưu riêng mã quản trị cùng giá trị vào `.env.zalo-admin.local` (đã được gitignore): `ZALO_SETUP_KEY=<giá trị riêng>`. Chạy `node --env-file=.env.zalo-admin.local workers/admin.mjs check`. ID do API trả về hiện là `3232808305802016399`; ID trong đường dẫn mở bot là `576169620734670481`. Luôn xác minh bằng mã gửi qua đường dẫn đúng trước khi bật nhận đơn.
5. Tạo mã xác minh mới bằng `node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log('ANTIN-'+randomBytes(12).toString('hex').toUpperCase())"`. Chạy `node --env-file=.env.zalo-admin.local workers/admin.mjs pair ANTIN-<mã vừa tạo>` để mở kết nối chờ. Trong 30 giây tiếp theo, chủ website gửi đúng mã này trong tin nhắn riêng tới [bot An Tín](https://bot.zaloplatforms.com/bots/576169620734670481). Nếu hết thời gian chờ, chạy lại lệnh rồi gửi lại mã. Bot không được có webhook khác đang hoạt động khi ghép bằng getUpdates. Kiểm tra lại phải trả về `paired: true`. Không tự động ghép lại sang tài khoản khác.
6. Sau khi kiểm tra nhận thông báo thử, đặt `ORDER_API_URL` thành `https://antin-orders.minhtran123hehe.workers.dev/orders`, cập nhật phiên bản cache của `config.js` trong `index.html`, rồi triển khai website qua nhánh `main`. Triển khai GitHub Pages không tự triển khai Worker.

### Cách xử lý yêu cầu

- Worker tự đọc catalogue đã xuất bản và tính giá; không tin giá, nội dung thông báo hoặc người nhận do trình duyệt gửi lên. Giá chưa xác định giữ “Liên hệ”. Đây là yêu cầu liên hệ xác nhận hàng, chưa phải thanh toán hoặc xác nhận đơn bán.
- Cùng một mã yêu cầu và nội dung được chống gửi trùng trong 30 ngày. Khi phản hồi Zalo không rõ ràng, website báo chưa xác nhận; khách liên hệ kèm mã yêu cầu để kiểm tra, không tự gửi lại thông báo có thể đã được nhận.
- Tối đa 3 yêu cầu mới/phút/địa chỉ IP và 2 tin nhắn Zalo/yêu cầu; danh sách quá dài cần chia nhỏ. Kiểm tra Origin và giới hạn IP chỉ giảm gửi nhầm/spam cơ bản, không thay thế cơ chế xác thực khách hàng.
- Durable Object lưu tài khoản nhận, mã băm nội dung và trạng thái gửi; không lưu tên, số điện thoại hoặc nội dung đơn. Thông báo có các thông tin khách cung cấp được chuyển tới Zalo. Log Worker mặc định tắt.
- Khi cần tạm ngừng, để trống `ORDER_API_URL` rồi triển khai lại website; khách vẫn sử dụng chức năng sao chép và mở Zalo.

## Tài khoản khách hàng

- Đăng ký/đăng nhập bằng số điện thoại và mật khẩu; thông tin gồm họ tên, tỉnh/thành, xã/phường, địa chỉ cụ thể. Không có mục “Bạn là”. Đăng ký thành công sẽ đăng nhập ngay.
- Gửi yêu cầu đặt hàng bắt buộc đăng nhập (`REQUIRE_ACCOUNT_LOGIN=true` ở Worker). Máy chủ lấy thông tin người gửi từ phiên đăng nhập, không tin ID/tên/địa chỉ do trình duyệt tự khai trong đơn. Đơn Zalo kèm mã khách và địa chỉ để An Tín làm việc tiếp với khách.
- Khách sửa tên/địa chỉ, đổi mật khẩu, đăng xuất và xóa tài khoản trong cửa sổ Tài khoản. Số điện thoại đăng nhập giữ nguyên. Quên mật khẩu hiện dùng liên hệ hỗ trợ qua Zalo; chưa có khôi phục tự động hoặc xác minh OTP, không coi số điện thoại tự đăng ký là danh tính đã xác thực. Không cấp lại quyền chỉ dựa trên người tự khai số điện thoại.
- `workers/accounts.mjs` lưu tài khoản trong SQLite Durable Object `CustomerAccounts`, migration `v2-accounts`; giữ nguyên dữ liệu ghép bot của `OrderReceiver`. Không dùng Sheet công khai để lưu khách. Mật khẩu dùng scrypt với salt ngẫu nhiên riêng (N=16384, r=8, p=5), theo [cấu hình OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Phiên đăng nhập là mã ngẫu nhiên 256 bit, lưu dạng băm phía máy chủ, hết hạn sau 8 giờ, tối đa 5 phiên/tài khoản. Đổi mật khẩu thu hồi các phiên cũ. Trình duyệt giữ mã phiên trong sessionStorage của tab; không lưu mật khẩu hoặc hồ sơ vào localStorage. Cách này hoạt động giữa GitHub Pages và workers.dev mà không phụ thuộc cookie bên thứ ba. Không thêm script bên thứ ba không tin cậy vì script cùng trang có thể đọc mã phiên.
- Có giới hạn thử đăng nhập theo IP và số điện thoại, giới hạn đăng ký 5 lần/ngày/IP. Giới hạn đăng ký bao gồm các lần đăng ký bị từ chối; hỗ trợ trường hợp nhiều khách dùng chung mạng nếu nhu cầu thực tế tăng. Không gửi tin nhắn SMS hoặc mở dịch vụ trả phí.
- Giỏ hàng trên cùng trình duyệt tách theo tài khoản. Các sản phẩm khách chọn trước khi đăng nhập được chuyển vào giỏ tài khoản. Giỏ chưa đồng bộ giữa nhiều thiết bị.
- Danh sách địa chỉ lấy từ [Province Open API v2](https://provinces.open-api.vn/), lưu bản sao ở `data/locations.json` (34 tỉnh/thành, 3321 xã/phường tại lần cập nhật). Chạy `node scripts/sync-locations.mjs` để cập nhật có kiểm tra cấu trúc. Website đọc file cùng nguồn; không gửi thông tin khách đến API địa chỉ.
- Khi triển khai: chạy kiểm tra, triển khai Worker với dependency đã cài, sau đó push website lên `main`. Artifact Pages chỉ có mã giao diện, danh mục, ảnh và danh sách địa chỉ; không chứa cơ sở dữ liệu, mã quản trị hoặc secret.
