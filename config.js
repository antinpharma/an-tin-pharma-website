window.ANTIN_CONFIG = {
  // Nguồn danh mục Data sàn; workflow đọc riêng tư rồi xuất catalogue.js.
  GOOGLE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit",
  SHEET_NAME: "check",

  // Nguồn giá cho quy trình cập nhật catalogue: Google Sheet "Data sàn".
  // Tab check, tiêu đề dòng 2; chỉ MIENNAM. Nguồn mới dùng nghìn đồng (xác nhận 24/09/2026).
  PRICE_SOURCE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit",
  // Giữ trống URL đọc giá trực tiếp của trình duyệt vì nguồn có thể bị giới hạn quyền.
  // Đọc nguồn bằng tài khoản được cấp quyền rồi cập nhật giá vào catalogue.js.
  PRICE_SHEET_URL: "",
  PRICE_SHEET_NAME: "check",
  PRICE_REGION: "MIENNAM",
  PRICE_MULTIPLIER: 1000,

  // H:I:J chỉ đọc từ backup, ghép theo Product ID; tiêu đề ở dòng 1.
  DETAIL_SOURCE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1AlreWSLbHiXHGP9BqdMH1WC_wVyEbV3pRREXVuD3r9k/edit",
  DETAIL_SHEET_NAME: "Sheet1",

  // Liên hệ - điền sau.
  ZALO_PHONE: "0905561550",
  // Chỉ bật sau khi Worker đã ghép đúng tài khoản nhận đơn. Không đặt Bot Token ở đây.
  ORDER_API_URL: "https://antin-orders.minhtran123hehe.workers.dev/orders",
  FACEBOOK_URL: "https://www.facebook.com/profile.php?id=61594629503087"
};
