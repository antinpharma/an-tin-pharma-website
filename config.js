window.ANTIN_CONFIG = {
  // Catalogue website do automation cập nhật từ Drive.
  GOOGLE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1RAd4Dcv3TP6ecEso0wi4gf5y9oV_PTSUwHOkE1Q-F74/edit",
  SHEET_NAME: "San pham",

  // Nguồn giá cho quy trình cập nhật catalogue: Google Sheet "Data sàn".
  // Tab check, tiêu đề dòng 2; chỉ MIENNAM, retail_price_value x1000.
  PRICE_SOURCE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1TEOQde1O0JoikDJJnIbe6sdpGl3GL76kJf1hQ_MapCU/edit",
  // Giữ trống URL đọc giá trực tiếp của trình duyệt vì nguồn có thể bị giới hạn quyền.
  // Đọc nguồn bằng tài khoản được cấp quyền rồi cập nhật giá vào catalogue.js.
  PRICE_SHEET_URL: "",
  PRICE_SHEET_NAME: "check",
  PRICE_REGION: "MIENNAM",
  PRICE_MULTIPLIER: 1000,

  // Liên hệ - điền sau.
  ZALO_PHONE: "0905561550",
  FACEBOOK_URL: "https://www.facebook.com/profile.php?id=61594629503087"
};
