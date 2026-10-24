# Rà soát nhóm sản phẩm và chuyên khoa — 24/10/2026

Rà soát catalogue 625 Product ID. Bản cũ có 117 mã chưa phân nhóm. Phân nhóm
theo hoạt chất, đường dùng, mục đích chính và loại sản phẩm; ghép bằng Product ID.
Đây là danh mục duyệt sản phẩm do website biên tập, không phải chứng nhận ATC,
chỉ định điều trị mới, hướng dẫn kê đơn hoặc danh sách an toàn trong thai kỳ.
Giữ nguyên catalogue, nội dung H:I:J, giá, tồn kho và product_category của Sheet.

## Quy tắc

- Một nhóm chính cho mỗi mã; một sản phẩm có thể liên quan nhiều chuyên khoa.
- Tách corticosteroid toàn thân, enzym chống phù nề, thuốc giảm đau dùng ngoài,
  thuốc chống đông, thuốc bổ huyết, kháng virus, ký sinh trùng và kháng sinh.
- Đường dùng và phối hợp hoạt chất quan trọng: thuốc ho có codein không xếp
  vào giảm đau chỉ vì hoạt chất; dầu gội chứa thuốc không xếp vào mỹ phẩm tóc.
- Chuyên khoa ưu tiên mục đích chính. Không đưa toàn bộ kháng sinh toàn thân
  vào Tai mũi họng/Da liễu/Cơ xương khớp chỉ vì nhãn có nhiễm khuẩn tại đó.
  Những thuốc này có nhóm riêng và mục Truyền nhiễm. Đây không phải giới hạn
  chuyên khoa được phép sử dụng thuốc.
- Nhi ưu tiên sản phẩm dành riêng cho trẻ được đối chiếu; không tự chọn mọi
  thuốc có thêm liều cho người dưới 18 tuổi. Nexium 40 mg, loperamid viên 2 mg,
  Salonpas diclofenac 15+ và miếng làm mát cho người lớn không nằm trong mục Nhi.
  Giới hạn tuổi, cân nặng và chỉ định của từng thuốc vẫn phải được tuân thủ.
- Sản phụ khoa có thuốc phụ khoa, vệ sinh, que thử thai và sản phẩm được rà soát
  riêng. Không suy ra phù hợp cho thai phụ từ chuyên khoa hay từ cảnh báo thai kỳ.
- Thuốc tâm thần có mục riêng, không gộp toàn bộ vào thần kinh. Mục Mắt ưu tiên
  thuốc/dung dịch dùng ở mắt, không gộp mọi thuốc uống có chỉ định thứ cấp về mắt.
- Mã mới chưa được đối chiếu vẫn vào Chưa phân nhóm; không tự phân theo từ khóa.

## Nguồn chính và các trường hợp đã sửa

Các URL dưới đây được kiểm tra trong lần rà soát. Với các thuốc cùng hoạt chất
đã có trong catalogue, dùng hoạt chất/đường dùng sẵn có và khung phân loại tương
ứng; không lấy thông tin thuốc từ trang bán lẻ để bổ sung hoặc đổi H:I.

| Căn cứ | Áp dụng |
| --- | --- |
| [WHO: nguyên tắc phân loại theo công dụng và đường dùng](https://www.who.int/tools/atc-ddd-toolkit/atc-classification), [ATC/DDD 2026](https://atcddd.fhi.no/atc_ddd_index/) | Tham chiếu phân biệt nhóm dược lý; không coi nhóm duyệt của website là mã ATC chính thức. |
| [WHO CC H02AB](https://atcddd.fhi.no/atc_ddd_index/?code=H02AB&showdescription=no) | Prednison, methylprednisolon, betamethason uống: 1353, 5691, 12907, 58888, 601729, 3010, 10280, 1224462 → corticosteroid toàn thân. |
| [Domesco: hướng dẫn Dorocodon](https://www.domesco.com/pdf/150.%20Dorocodon.f53933de6b694b76c7b87add892e6aa1.pdf) | 10769 → ho/long đờm; không còn ở giảm đau. |
| [WHO CC G04BE03](https://atcddd.fhi.no/atc_ddd_index/?code=G04BE03&showdescription=no) | Sildenafil/tadalafil cho rối loạn cương: đổi tên nhóm để không mô tả là hormon. |
| [WHO CC R06AD01](https://atcddd.fhi.no/atc_ddd_index/?code=R06AD01&showdescription=no) | Alimemazin 69487, 4988 → kháng histamin; không tự xếp là thuốc tâm thần. |
| [Hisamitsu: sản phẩm](https://vn.hisamitsu/san-pham.html), [Salonpas diclofenac](https://vn.hisamitsu/salonpas-diclofenac.html), [Salonsip](https://vn.hisamitsu/salonsip-gel-patch.html) | Cao dán, gel, dầu xoa chứa hoạt chất giảm đau → thuốc dùng ngoài; 2000529 không ở Nhi. |
| [STELLA: Racetril 30](https://stellapharm.com/products/racetril-30/) | 516455 → tiêu chảy, Tiêu hóa và Nhi; nhãn có giới hạn tuổi/cân nặng, không áp dụng dạng viên 100 mg người lớn. |
| [STELLA: Partamol 250](https://stellapharm.com/vi/products/partamol-250/), [nhóm giảm đau của hãng](https://stellapharm.com/product-category/analgesics/) | 12144 và 899054 → giảm đau/hạ sốt, đối chiếu đúng hàm lượng và dạng bào chế. |
| [DHG: Molukat 4](https://dhgpharma.com.vn/vi/san-pham/ho-hap/molukat-4) | 68684 → hen/đường thở, Hô hấp và Nhi; không xếp như thuốc ho cắt cơn. |
| [Catalogue của CPC1 Hà Nội do hãng công bố trên CPHI](https://www.cphi-online.com/46/resourcefile/15/60/47/catalogue-cpc1hn-full.pdf), [tài liệu Falgankid tại Cục Quản lý Dược](https://dav.gov.vn/file/2016/Nam%202016%20theo%20TT%2013-2009/0523/img962.pdf) | Đối chiếu Profen/Falgankid theo tên, hoạt chất và hàm lượng, không suy ra từ dạng ống uống; Progermila/Domuvar thuộc thuốc men vi sinh. |
| [Mega: ENAT 400](https://vn.megawecare.com/vitamin/enat-400/), [NAT C 1000](https://vn.megawecare.com/vitamin/thuc-pham-bao-ve-suc-khoe-mega-we-care-nat-c/) | 1482 là thuốc vitamin, 3017 là thực phẩm hỗ trợ; không gộp hai loại chỉ vì đều là vitamin. |
| [Bayer: Elevit](https://elevit.bayer.com.vn/san-pham) | 76928 → bổ sung vitamin/khoáng chất và Sản phụ khoa. |
| [Doppelherz: Kinder Optima](https://doppelherz.vn/san-pham/tre-em/thuc-pham-bao-ve-suc-khoe-kinder-optima/) | 88829 → hỗ trợ tiêu hóa/ăn ngon và Nhi; mô tả sản phẩm trên nguồn xác nhận mục đích này. |
| [Nam Dược: Livecool](https://namduoc.vn/livecool/) | 53405, 54430, 54431 → hỗ trợ thanh nhiệt/gan, không phải thuốc hạ sốt. |
| [Thương hiệu Bio-acimin: Gold và Gold+](https://www.bioacimin.com/faq/san-pham-bio-acimin-gold-co-gi-khac-voi-san-pham-bio-acimin-gold) | 2448 → thực phẩm hỗ trợ tiêu hóa; không đồng nhất với thuốc men vi sinh. |
| [Traphaco CNC: Tottri viên hoàn cứng](https://www.traphacocnc.com/cong-ty-co-phan-cong-nghe-cao-traphaco-vinh-du-don-nhan-huan-chuong-lao-dong-hang-nhi-copy/) | 3790 dạng hoàn/gói → thuốc trị trĩ; giữ riêng 6580 dạng viên TPBVSK theo dữ liệu hiện có. |
| [Bộ Y tế: Medoral](https://imda.moh.gov.vn/documents/10182/59895854/Medoral.%C4%90K%20h%E1%BB%99i%20th%E1%BA%A3o_1729741862153.pdf?fileId=59904298&version=1.0), [Dermatix Ultra Kids](https://vimda.moh.gov.vn/documents/10182/37453283/upload_00060219_1668677433295.pdf?fileId=37484380&version=1.0) | 10908 → vật tư/dung dịch chăm sóc miệng; 94627 → gel silicone, thêm Nhi có đối chiếu sản phẩm trẻ em. |
| [Khang Dược: trang của nhà sản xuất/phân phối](https://khangduoc.vn/khang-duoc-vinh-du-nhan-giai-huy-chuong-vang-vi-suc-khoe-cong-dong-2019/) | 2342 → hỗ trợ sinh lý nam; vào Nam khoa, không vào Sản phụ khoa. Không dùng quảng cáo để tạo thêm chỉ định thuốc. |

## Kiểm tra hành vi lọc

Chọn khoa giữ nguyên nhóm đang chọn; chọn nhóm giữ nguyên khoa. Điều kiện là
giao của khoa, nhóm, danh mục và từ khóa. Số đếm ở mỗi lựa chọn đã tính điều
kiện của bộ lọc còn lại; lựa chọn không có kết quả vẫn hiện số 0 để người dùng
đổi được bộ lọc. Xóa bộ lọc đưa tất cả lựa chọn về trạng thái ban đầu.
