// Product navigation reviewed 2026-10-24. See docs/product-filter-review.md.
// Exact Product IDs only; new products require review. This does not change
// catalogue descriptions, Sheet categories, prices or approved indications.
(() => {
  const sections = [
    ["medicines", "Nhóm thuốc", [
      ["pain", "Giảm đau, hạ sốt, NSAID"],
      ["topical-pain", "Giảm đau dùng ngoài, cao dán"],
      ["joints", "Cơ, xương, khớp"],
      ["anti-oedema", "Enzym chống phù nề"],
      ["corticosteroids", "Corticosteroid toàn thân"],
      ["diabetes", "Đái tháo đường"],
      ["cardio", "Tim mạch, huyết áp"],
      ["lipids", "Rối loạn lipid máu"],
      ["veins", "Tĩnh mạch, bầm tím"],
      ["antithrombotic", "Chống đông, chống kết tập tiểu cầu"],
      ["blood", "Thiếu máu, thuốc bổ huyết"],
      ["liver", "Gan, mật"],
      ["digestive", "Dạ dày, trào ngược, khó tiêu"],
      ["intestinal", "Tiêu chảy, táo bón"],
      ["motility", "Chống nôn, chống co thắt tiêu hóa"],
      ["probiotic-medicines", "Thuốc men vi sinh"],
      ["haemorrhoids", "Thuốc điều trị trĩ"],
      ["respiratory", "Ho, long đờm, cảm lạnh"],
      ["ent-local", "Thuốc tai, mũi, họng tại chỗ"],
      ["asthma", "Hen, dị ứng đường thở"],
      ["allergy", "Kháng histamin (chống dị ứng)"],
      ["antimicrobial", "Kháng sinh toàn thân"],
      ["antiviral", "Kháng virus"],
      ["antiparasitic", "Giun, sán, ký sinh trùng"],
      ["dental", "Thuốc nhiễm khuẩn răng miệng"],
      ["eyes", "Mắt"],
      ["nerves", "Thần kinh, trí nhớ, đau thần kinh"],
      ["dizziness", "Chóng mặt, say tàu xe"],
      ["psychiatry", "Thuốc tâm thần"],
      ["hormones", "Rối loạn cương, sinh lý nam"],
      ["gynaecology", "Phụ khoa"],
      ["urinary", "Tiết niệu"],
      ["skin", "Viêm da, chăm sóc da bằng thuốc"],
      ["acne-medicines", "Thuốc điều trị mụn"],
      ["antifungal-skin", "Thuốc nấm da"],
      ["med-vitamins", "Vitamin, khoáng chất"],
    ]],
    ["supplements", "Sản phẩm hỗ trợ sức khỏe", [
      ["support-joints", "Hỗ trợ cơ, xương, khớp"],
      ["support-liver", "Hỗ trợ gan, mật"],
      ["support-nerves", "Hỗ trợ não, thần kinh"],
      ["support-respiratory", "Hỗ trợ tai, mũi, họng"],
      ["support-blood", "Hỗ trợ tạo máu"],
      ["support-digestive", "Hỗ trợ tiêu hóa, ăn ngon"],
      ["support-cardio", "Hỗ trợ tim, mạch"],
      ["support-vitality", "Hỗ trợ sinh lý, sức khỏe sinh sản"],
      ["supp-vitamins", "Bổ sung vitamin, khoáng chất"],
      ["support-immunity", "Hỗ trợ sức đề kháng"],
    ]],
    ["devices", "Thiết bị và vật tư y tế", [
      ["dressings", "Băng, gạc và vật tư tiêu hao"],
      ["tests", "Que thử thai"],
      ["cooling", "Miếng dán, khăn làm mát"],
      ["nasal-care", "Dụng cụ và dung dịch vệ sinh mũi"],
      ["eye-care", "Chăm sóc mắt, nước mắt nhân tạo"],
      ["scar-device", "Gel silicone chăm sóc sẹo"],
      ["oral-devices", "Gạc và dung dịch vệ sinh miệng"],
    ]],
    ["beauty", "Dược mỹ phẩm, chăm sóc cá nhân", [
      ["face-cleanser", "Làm sạch da mặt"],
      ["moisturiser", "Dưỡng ẩm, phục hồi da"],
      ["acne-scar", "Chăm sóc da mụn, thâm, sẹo"],
      ["sun-care", "Chống nắng"],
      ["body-hair", "Chăm sóc cơ thể, tóc"],
      ["baby-care", "Chăm sóc da em bé"],
      ["intimate-care", "Vệ sinh phụ nữ"],
      ["oral-care", "Vệ sinh răng miệng"],
    ]],
    ["daily", "Sản phẩm chăm sóc hằng ngày", [
      ["balms", "Tinh dầu, dầu chăm sóc"],
      ["repellent", "Chống muỗi, côn trùng"],
      ["sexual-health", "Sức khỏe giới tính"],
      ["food", "Thực phẩm bổ sung, đồ uống"],
    ]],
  ].map(([id, label, children]) => ({id, label, children: children.map(([id, label]) => ({id, label}))}));

  const assignments = {
    "pain": "1391 2461 2522 3513 3916 4131 6822 7127 7410 8539 11757 12076 12144 13761 13768 15675 16245 62586 68505 72195 90100 93759 157973 170938 212610 899054 2014877",
    "topical-pain": "1897 2362 2731 2790 5722 9496 9497 11907 11908 12443 15072 74170 86562 86563 273581 2000529",
    "joints": "1125 1126 2799 3183 4950 13001 14073",
    "anti-oedema": "1358 1371 12878",
    "corticosteroids": "1353 3010 5691 10280 12907 58888 601729 1224462",
    "diabetes": "1926 2494 4370 5484 6939 7076 8281 11067 12897 15922 514836 2014238 2017173",
    "cardio": "1574 1633 1857 2056 2543 2775 3446 4876 5240 5724 6645 7697 7945 7946 7981 8272 9334 10074 11474 12750 12926 12972 12977 13429 13763 13764 13766 14791 15901 15910 16183 68765 69075 69076 69078 69109 69111 70118 70121 91471 101861 1034145 1263661 2016649",
    "lipids": "1591 1912 13716 51793 69087",
    "veins": "7685 13011",
    "antithrombotic": "7008 9927 9929 68667 70014 80546 400941 400946 400949 1253485 2027054",
    "blood": "1895 6887 10704 70088 220989",
    "liver": "1483 7130",
    "digestive": "1504 1505 1532 1539 1823 2180 2198 2567 2764 4810 5488 5936 7030 8585 12444 12609 13760 57022 72196 72435 107400 153505 163614 704407 1066384 2017161 2017859",
    "intestinal": "1511 3826 5283 6156 12150 13019 14887 15462 56848 395873 516455 2012842",
    "motility": "1794 6048 12496 13769 15595 70527 72197",
    "probiotic-medicines": "2307 2481 3423 5291 86504 439916",
    "haemorrhoids": "3790",
    "respiratory": "2282 2616 2892 2931 2970 3012 3343 3760 4496 4968 5778 8131 8141 9692 9947 10335 10769 11097 11124 12567 13111 13758 66089 67825 69489 82278 91710 102896 153525 240877 2017403 2023920 2024889",
    "ent-local": "1653 5777 15052 90016 750253",
    "asthma": "68684",
    "allergy": "4687 4988 5349 8375 10369 11602 13759 14943 14974 15191 15887 15896 57579 69487 69856 70499 77294 103903 138701 368117",
    "antimicrobial": "1320 1323 1326 1619 1829 2165 2424 2631 2660 2780 2900 2975 3030 3102 3332 3561 3720 3924 5497 6163 6995 7656 7867 8463 9015 9241 10759 11178 12899 12925 12944 12999 13502 13755 15890 53581 54445 54525 58031 63818 68490 69502 69531 69752 70502 70505 72112 84262 88994 91721 100034 114514 499398 682973 2020703",
    "antiviral": "1903 2009934 2016739",
    "antiparasitic": "1225 2534 80962 171743 349792 349814",
    "dental": "1286 1317 3896",
    "eyes": "1399 1652 3595 11347 14719 15519 80806 81188 87366 87775 108706 170948 551763",
    "nerves": "1738 2331 2859 3262 3458 4146 5090 5511 11498 335070 2024100 2024680",
    "dizziness": "2471 3647 6842",
    "psychiatry": "1251 3212 10726 60754 334044 334087 334112 335046 1254338 2000785 2002592 2024682",
    "hormones": "5830 9671 9903 13767 16047 80786",
    "gynaecology": "3172 8161 9365 16191 78106",
    "urinary": "1249",
    "skin": "1145 1737 2113 3268 3538 4653 4840 6270 12105 13018 14642 15529 16235 80850 120703 336186 431727 567944 2015724 2016615 2017400 2017404",
    "acne-medicines": "1146 1153 8456 54190 82832 101952 368191 2024641",
    "antifungal-skin": "2986 7850 53482 80804 88046 598964 2023843",
    "med-vitamins": "1113 1482 1824 2251 2315 2513 5045 5420 7149 8229 12901 13004 15084 69858 315677 2017207",
    "support-joints": "10554 86215 89362 102483 2002702 2010131 2012666",
    "support-liver": "10562 53405 54430 54431 252422 2014890",
    "support-nerves": "87132 119173 290243 691165 851419",
    "support-respiratory": "2683 4102 7091 9985 80919 88828 89261 255137",
    "support-blood": "86482 86961 2002866 2021326",
    "support-digestive": "2448 2604 6580 59485 59486 70760 88829 229780 2019036 2019889",
    "support-cardio": "2691 70718 89128",
    "support-vitality": "2342 86943 106596",
    "supp-vitamins": "3017 3252 3851 5748 6810 76928 86284 89058 93679 1242392 2002701 2004446 2013396 2016446 2026407",
    "support-immunity": "1203336 2008226 2014341 2015013",
    "dressings": "2204 2304 3116 58120 58121",
    "tests": "71962 80664 260189 2011041 2017390",
    "cooling": "6268 10771 80945 84166 113281 167522 387885",
    "nasal-care": "8800 54443 54444 119184 128314 151479 151480 151484 585918",
    "eye-care": "147115 147232 147233 147242 147260 147273 170729 2024460",
    "scar-device": "1692 3134 94627",
    "oral-devices": "10908 84168 113280 167518 1270457",
    "face-cleanser": "2379 69266 77841 97130 224998 231318 288180 338559 613770 2005534 2009263 2012028 2012029 2012030 2012031 2026421 2027997",
    "moisturiser": "8534 10478 10514 10521 77976 225065 2005518 2011191 2012676",
    "acne-scar": "1226 4139 6221 9165 10467 10854",
    "sun-care": "4314 382474 2013678",
    "body-hair": "79203 315622 1231756 2005507",
    "baby-care": "1898 2337 3408 3710 7058 10517 59965 93999 94000 94001 231541 231543 272975 311640 1234461 2021954 2026324",
    "intimate-care": "1757 2565 2842 3000 6477 13040 13969 299616",
    "oral-care": "1878 2848 3338 6534 13762 173191",
    "balms": "8482 67943 133561 1229179",
    "repellent": "11734 200262",
    "sexual-health": "2008",
    "food": "1655 2618 11905 11906 12927 94037 102943 229802 229806 2008755 2009845 2009846 2023268 2023629"
  };
  const byProduct = Object.create(null);
  const groups = new Map(sections.flatMap(section => section.children.map(group => [group.id, {...group, parent: section.id}])));
  const unassigned = {id: 'unassigned', label: 'Chưa phân nhóm'};
  for (const [group, ids] of Object.entries(assignments)) {
    if (!groups.has(group)) throw new Error('Unknown product group: ' + group);
    for (const id of ids.split(' ')) {
      if (byProduct[id]) throw new Error('Duplicate grouped Product ID: ' + id);
      byProduct[id] = group;
    }
  }
  function groupFor(product) { return groups.get(byProduct[String(product.productId)]) || unassigned; }
  function matches(product, selected = 'all') {
    const group = groupFor(product);
    return selected === 'all' || group.id === selected || group.parent === selected;
  }
  function labelFor(id) { return groups.get(id)?.label || sections.find(section => section.id === id)?.label || (id === 'unassigned' ? unassigned.label : 'Tất cả nhóm sản phẩm'); }
  window.ANTIN_GROUPS = {sections, groupFor, matches, labelFor};
})();
