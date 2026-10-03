# An Tín Pharma Website

Website catalogue responsive cho An Tín Pharma.

Website: https://antinpharma.github.io/an-tin-pharma-website/
Repository: `antinpharma/an-tin-pharma-website`.

## Chức năng hiện có
- Responsive desktop / tablet / mobile
- Tìm kiếm theo tên sản phẩm, hoạt chất, quy cách
- Lọc danh mục
- Card sản phẩm
- Nút liên hệ Zalo / Facebook
- Sẵn sàng deploy bằng GitHub Pages

## Đồng bộ danh mục và giá tự động

- Ảnh catalogue có bản thu nhỏ WebP 320px và 640px, tạo từ ảnh đã mirror; trình duyệt chọn theo mật độ màn hình. Giữ nguyên ảnh lớn, dùng làm dự phòng nếu bản thu nhỏ tải lỗi. Đồng bộ hằng ngày tự tạo bản thu nhỏ cho ảnh mới và sửa file thu nhỏ bị thiếu từ bản lưu, không tải lại CDN khi không cần. Năm ảnh đầu kết quả được tải ưu tiên; các ảnh sau tải khi gần vùng xem. Trang chỉ dựng danh sách một lần khi khởi tạo, vẫn giữ toàn bộ sản phẩm để tìm kiếm/lọc.

- [Data sàn](https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit), tab `check`, tiêu đề dòng 2: chỉ đọc A:G để lấy mã, miền, tên, hãng, danh mục và giá. Cột G `Tồn khả dụng`: MIENNAM có giá trị số 0 hiển thị “Hết hàng” và không được thêm vào giỏ/gửi đơn; vẫn liên hệ Zalo được. Không xuất số lượng tồn. Ô trống, không hợp lệ hoặc mâu thuẫn thì trạng thái chưa xác định.
- [Data sàn backup 1](https://docs.google.com/spreadsheets/d/1AlreWSLbHiXHGP9BqdMH1WC_wVyEbV3pRREXVuD3r9k/edit), tab `Sheet1`, tiêu đề dòng 1: đọc A:J nhưng chỉ dùng Product ID + miền để ghép H `Hoạt chất`, I `Chỉ định`, J `link ảnh URL`. Bỏ qua tên, giá và tồn kho cũ trong backup. Tuyệt đối không dùng H:J của Data sàn vì thứ tự dòng có thể thay đổi.
- Lịch: **11:17 hằng ngày** theo giờ Việt Nam (cron `17 4 * * *`). Dự phòng **11:47, 12:17, 15:47** (cron `47 4 * * *`, `17 5 * * *`, `47 8 * * *`): chỉ bỏ qua khi ngày nguồn và ngày kiểm tra cùng là hôm nay theo giờ Việt Nam, catalogue/index/status đã xuất bản khớp. Nguồn hôm trước dù chưa quá 36 giờ vẫn chạy lại; email cảnh báo nguồn khác ngày. Đồng thời chạy khi push lên `main` hoặc chạy thủ công. GitHub có thể chạy trễ hoặc bỏ lượt; các lịch này không bảo đảm thời gian thực.
- Google Sheets API được thử lại tối đa 3 lần với lỗi mạng, HTTP 429/500/502/503/504. Lỗi quyền, cấu trúc và đơn vị giá vẫn dừng; không thử đoán giá hoặc tự đổi hệ số.
- Sau mỗi lượt đọc thành công, `data/catalogue-status.json` ghi thời điểm kiểm tra, thời điểm nguồn ở A1, số sản phẩm mới, số giá thay đổi, số trạng thái tồn thay đổi, số giá “Liên hệ” và SHA-256 catalogue. Không ghi số lượng tồn. Nguồn quá 36 giờ/không nhận diện được thời điểm/thời điểm ở tương lai có cảnh báo riêng. Thời điểm kiểm tra không đồng nghĩa nguồn đã được cập nhật.
- Website hiển thị thời điểm kiểm tra và nguồn ở cuối trang. Dấu thời gian được triển khai ngay cả khi giá không đổi. Nếu lỗi đồng bộ, giữ dấu thời gian của lần thành công trước. Sau triển khai, workflow đối chiếu trực tiếp catalogue, phiên bản cache trong index và thời điểm status trên GitHub Pages; không chỉ dựa vào nút xanh của bước deploy.
- Chạy ngay: GitHub → Actions → **Update prices and deploy website** → **Run workflow** → nhánh `main`.
- Chỉ ghép chính xác Product ID và `sales_region_code = MIENNAM`; nguồn mới trả giá theo nghìn đồng, nhân 1.000 (người dùng xác nhận lại ngày 24/09/2026): 113 → 113.000đ, 322 → 322.000đ. Nếu phần lớn giá đột ngột tăng/giảm khoảng 1.000 lần, dừng đồng bộ và xác nhận lại hệ số, không tự đoán.
- Dòng MIENNAM mới trong Data sàn tự thêm sản phẩm. Đồng bộ tên (`product_name`), hãng (`brand`), nhóm (`product_category`) từ Data sàn; hoạt chất, chỉ định từ backup. Ô trống hoặc không có mã trong backup giữ thông tin cũ; sản phẩm mới thiếu thông tin hiển thị “Đang cập nhật”. Giữ quy cách hiện có. Không đoán dữ liệu thuốc.
- Ảnh từ J trong backup được tải về `images/sheet` rồi ghép theo đúng Product ID miền Nam. Hiện hỗ trợ CDN `cdn-gcs.thuocsi.vn`. URL trống hoặc tải lỗi giữ ảnh cũ; không xóa ảnh cũ. Sản phẩm chưa có ảnh dùng ô “Ảnh sản phẩm”. Không tự xóa sản phẩm khi vắng trong nguồn; mã chỉ có trong backup chưa tự tạo sản phẩm bán mới.
- Khi bổ sung nội dung: tìm Product ID ở backup rồi điền H:I:J trên cùng dòng. Có thể sắp xếp **toàn bộ A:J**, không sắp xếp riêng H:I:J. Không cần giữ thứ tự dòng giữa hai file giống nhau. Nếu mã miền Nam bị trùng nhưng nội dung khác nhau, dừng đồng bộ để tránh gán nhầm.
- Giá thiếu/không hợp lệ/mâu thuẫn dùng “Liên hệ”. Nguồn không đọc được, không có dữ liệu miền Nam hoặc sai tiêu đề thì workflow thất bại và giữ website đã triển khai.
- Danh mục hoặc giá thay đổi sẽ tạo commit cho `catalogue.js` và cache trong `index.html`. Trình duyệt chỉ đọc catalogue đã xuất bản; không đọc CSV công khai hoặc quay về Sheet `San pham` cũ. Workflow tự triển khai Pages bằng artifact chỉ chứa file website, kể cả khi commit của bot không kích hoạt lần build mới.
- Xem kết quả và số sản phẩm thay đổi trong Actions → lần chạy → Summary. Số sản phẩm thay đổi tổng hợp có thể gồm giá, trạng thái tồn, metadata và ảnh; báo cáo ghi riêng số **giá** thay đổi.

### Email báo cáo hằng ngày

Địa chỉ nhận/gửi: **nguyenphuockhaimkn@gmail.com**. Email tập trung ở Worker `antin-price-scheduler`, **tối đa 2 lần/ngày theo giờ Việt Nam**: tối đa một cảnh báo khi chưa có nguồn hôm nay từ 12h, và tối đa một xác nhận khi website đã phục vụ nguồn hôm nay, đối chiếu SHA-256 và phiên bản trang thành công. Ngày hoạt động bình thường chỉ có một thư xác nhận. Nếu nguồn vẫn cũ cả ngày thì chỉ có một cảnh báo.

Thiết lập một lần:

1. Đăng nhập đúng Gmail trên, bật Xác minh 2 bước, tạo [Mật khẩu ứng dụng](https://myaccount.google.com/apppasswords) tên `An Tin daily prices`. Xem [hướng dẫn Google](https://support.google.com/mail/answer/185833). Không dùng mật khẩu đăng nhập Gmail thông thường.
2. Mở Cloudflare → Workers & Pages → `antin-price-scheduler` → Settings → Variables and Secrets. Lưu mật khẩu ứng dụng vào Secret **PRICE_REPORT_APP_PASSWORD**. Không gửi mã qua chat, commit hoặc ghi vào config.js. Secret SMTP cũ trên GitHub không còn được workflow sử dụng.
3. Kiểm tra `/health` của Worker: `emailConfigured`, `notificationLimit: 2`, `notificationDay`, `notificationAttempts` và `mail`. `smtp_accepted` xác nhận Gmail nhận gửi, không xác nhận thư đã vào Inbox; kiểm tra cả thư rác.

GitHub job `notify` chỉ ghi báo cáo từng lượt vào **Actions Summary**, kể cả khi đồng bộ/triển khai/xác minh lỗi. Push, chạy thủ công và retry không gửi thêm email. Worker vẫn kiểm tra mỗi 10 phút và đồng bộ khi cần; giảm email không giảm việc giám sát. Hạn mức lưu trong Durable Object, giữ qua deploy/restart, reset theo ngày Việt Nam. Mọi lần thử SMTP đều tính vào hạn mức, kể cả thư kiểm tra quản trị và kết quả không rõ; không tự gửi lại. Chưa có secret thì `/health` ghi `emailConfigured: false`, không báo đã gửi. Email lỗi không làm mất catalogue đã triển khai.

### Bộ hẹn giờ và giám sát độc lập trên Cloudflare

Worker `antin-price-scheduler` dùng `workers/wrangler-price-scheduler.jsonc`, tách khỏi Worker đặt hàng. Cloudflare kiểm tra mỗi 10 phút từ **11:17 đến 18:57 giờ Việt Nam**; lượt cron 11:07 không làm gì. Giữ lịch GitHub làm đường dự phòng. Cron của cả hai nền tảng vẫn không phải cam kết chạy đúng từng phút.

- Khi ngày nguồn và ngày kiểm tra là hôm nay, chỉ coi hoàn tất sau khi SHA-256 catalogue và phiên bản cache trong index khớp status đang phục vụ.
- Nếu chưa đạt, đọc danh sách lượt chạy trên nhánh `main`. Đang chờ/đang chạy thì không tạo lượt khác; lỗi API thì không gọi mù. Khi không có lượt đang chạy, gọi `workflow_dispatch` trên `main`.
- Lưu thời điểm thử trước khi gọi, dùng lease trong Durable Object để tránh hai cron cùng xử lý. Ba lần đầu cách ít nhất 10 phút; sau đó cách ít nhất 30 phút để tránh liên tục chạy lại khi nguồn chưa đổi. Kiểm tra website vẫn mỗi 10 phút trong khung giờ trên.
- Từ 12h nếu chưa xác minh được bản của hôm nay, gửi một email cảnh báo trực tiếp qua SMTP Gmail từ Cloudflare. Khi xác minh được, gửi một thư xác nhận riêng. Tối đa một lần thử mỗi loại/ngày và tối đa **2 lần thử tổng/ngày**, gồm cả thư kiểm tra quản trị; kết quả SMTP không rõ cũng chiếm một lượt, không tự gửi lại. GitHub không gửi SMTP riêng. `smtp_accepted` chỉ xác nhận máy chủ Gmail nhận thư, không xác nhận đã vào Inbox.
- `/health` chỉ đọc: trạng thái cấu hình, lần kiểm tra, lần cron thực tế (`lastCronAt`), lần yêu cầu cập nhật, kết quả xác minh và gửi mail. Các đường `/admin/check`, `/admin/dispatch-check`, `/admin/mail-check`, `/admin/test-mail` chỉ hoạt động với Bearer `SCHEDULER_ADMIN_KEY` riêng; không dùng GitHub token làm khóa quản trị. Khóa quản trị cục bộ nằm trong file bị Git bỏ qua `.env.price-scheduler-admin.local`.
- Gửi SMTP từ Workers dùng socket TLS trực tiếp đến hostname `smtp.gmail.com:465`; tránh bước Nodemailer tự phân giải ra IP bị TCP proxy từ chối. HTTP fetch dùng `redirect: manual`, kiểm tra mã trả về; Workers không hỗ trợ `redirect: error`. Không theo chuyển hướng kèm token GitHub.
- Kiểm tra quản trị có thể chạy ngoài khung giờ. `dispatch-check` yêu cầu chạy thật để kiểm chứng token kể cả website đã mới, vẫn tôn trọng lượt đang chạy và cooldown. `mail-check` chỉ xác thực Gmail, không gửi thư; `test-mail` gửi thư nhãn kiểm tra riêng tối đa một lần/ngày khi còn hạn mức 2 thư, không tự gửi lại thư hằng ngày có kết quả không rõ.

**Cần cấu hình hai Secret trước khi coi hệ thống sẵn sàng:** mở Cloudflare → Workers & Pages → `antin-price-scheduler` → Settings → Variables and Secrets → Add → Type **Secret** → Deploy.

| Tên Secret | Giá trị |
| --- | --- |
| `GITHUB_SCHEDULER_TOKEN` | Fine-grained token riêng của GitHub, owner `antinpharma`, chỉ repository `an-tin-pharma-website`, quyền **Actions: Read and write**. Theo dõi ngày hết hạn và thay token trước ngày đó. |
| `PRICE_REPORT_APP_PASSWORD` | Mật khẩu ứng dụng của `nguyenphuockhaimkn@gmail.com`. Có thể tạo mật khẩu ứng dụng riêng tên `An Tin Cloudflare monitor`; không dùng mật khẩu đăng nhập Gmail. Secret trên GitHub không thể đọc lại để chuyển sang đây. |

Triển khai code: `wrangler deploy --config workers/wrangler-price-scheduler.jsonc`. Giữ secrets trên Cloudflare; không đưa vào mã hoặc file cấu hình. Sau khi thêm secret, đợi một lượt trong khung giờ để xác minh `/health`, quyền dispatch và thư nhận thực tế; có secret chưa chứng minh nó hợp lệ. Chưa có secret thì bộ hẹn giờ chưa đầy đủ chức năng. Thay code ở GitHub không tự triển khai Worker này.

Tài liệu: [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [GitHub workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).

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
- Tối đa 3 yêu cầu mới/phút/địa chỉ IP và 50 loại sản phẩm/yêu cầu; danh sách tự chia thành các tin nhắn Zalo có đánh số phần. Bước gửi Zalo nằm ngoài khóa 30 giây của Durable Object; các lần gửi lặp đang xử lý cùng chờ một kết quả, không gửi lại. Trình duyệt chờ tối đa 3 phút cho đơn dài. Kiểm tra Origin và giới hạn IP chỉ giảm gửi nhầm/spam cơ bản, không thay thế cơ chế xác thực khách hàng.
- Durable Object lưu tài khoản nhận, mã băm nội dung và trạng thái gửi. Từ khi bật lịch sử, lưu thêm mã tài khoản, mã đơn, thời gian, danh sách sản phẩm/số lượng/giá tại lúc gửi và trạng thái gửi; không chép tên, điện thoại, địa chỉ khách vào bản lịch sử. Thông báo có các thông tin khách cung cấp được chuyển tới Zalo. Log Worker mặc định tắt.
- Khi cần tạm ngừng, để trống `ORDER_API_URL` rồi triển khai lại website; khách vẫn sử dụng chức năng sao chép và mở Zalo.

### Lịch sử đơn hàng và Báo lỗi / Góp ý

- Nút **Lịch sử đơn hàng** nằm cạnh nút gửi đơn trong giỏ hàng. API `POST /orders/history` luôn yêu cầu phiên đăng nhập, lấy mã tài khoản từ máy chủ; không tin mã tài khoản do trình duyệt cung cấp. Phân trang 20 đơn, mới nhất trước; lịch sử dùng được giữa các thiết bị và không lưu vào localStorage. Các đơn trước khi bật tính năng chỉ có mã băm xác nhận nên không thể khôi phục chi tiết.
- Lịch sử phản ánh yêu cầu đã gửi đến Bot, chưa phải trạng thái xác nhận bán hàng/giao hàng. Giá được chụp từ catalogue máy chủ lúc gửi. Lỗi/thiếu xác nhận Zalo hiển thị chưa xác nhận gửi đủ. Lịch sử không bị xóa theo lịch dọn mã chống trùng 30 ngày.
- **Báo lỗi / Góp ý** ở bên phải thanh lọc mở hộp nhập nội dung 10–1.200 ký tự. Khách chưa đăng nhập vẫn gửi được; tên/điện thoại không bắt buộc. Khách đăng nhập dùng thông tin tài khoản đã xác thực. Góp ý được gửi qua `POST /feedback` đến đúng tài khoản nhận đã ghép với AnTinpharma Bot; trình duyệt không chọn người nhận.
- Giới hạn góp ý 1 lần/30 giây và 10 lần/24 giờ/IP. Mã yêu cầu chống trùng 30 ngày; chỉ báo đã gửi khi có `message_id` từ Zalo. Không lưu nội dung góp ý tại máy chủ ngoài tin nhắn đã chuyển tới Bot; chỉ giữ mã băm và trạng thái chống trùng. Không tự gửi lại khi phản hồi chưa rõ.
- Giao diện trong `customer-tools.js`, API trong `workers/orders.mjs` và `workers/customer-services.mjs`. Triển khai Worker đặt hàng trước khi xuất bản giao diện mới; GitHub Pages phải đóng gói cả `customer-tools.js`. Kiểm thử `workers/customer-services.test.mjs` kiểm tra phân quyền, phân trang, giá chụp lúc gửi và chống trùng/lỗi mạng.

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
