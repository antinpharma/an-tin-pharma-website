// Navigation groups reviewed against catalogue names, ingredients and uses.
// These are browsing aids, not new indications or a replacement for product_category.
// Use exact Product IDs: new/unreviewed products stay in "Chưa phân nhóm".
(() => {
  const sections = [
    ['medicines', 'Nhóm thuốc', [
      ['pain', 'Giảm đau, hạ sốt, kháng viêm'],
      ['joints', 'Cơ, xương, khớp'],
      ['diabetes', 'Đái tháo đường'],
      ['liver', 'Gan, mật'],
      ['allergy', 'Kháng histamin (chống dị ứng)'],
      ['antimicrobial', 'Kháng vi sinh vật'],
      ['eyes', 'Mắt'],
      ['blood', 'Máu, huyết học'],
      ['nerves', 'Não, thần kinh'],
      ['hormones', 'Sinh lý, nội tiết tố'],
      ['gynaecology', 'Phụ khoa'],
      ['respiratory', 'Tai, mũi, họng và hô hấp'],
      ['digestive', 'Tiêu hóa, dạ dày'],
      ['cardio', 'Tim, mạch, huyết áp'],
      ['skin', 'Da liễu'],
      ['urinary', 'Tiết niệu'],
      ['med-vitamins', 'Vitamin, khoáng chất'],
    ]],
    ['supplements', 'Sản phẩm hỗ trợ sức khỏe', [
      ['support-joints', 'Hỗ trợ cơ, xương, khớp'],
      ['support-liver', 'Hỗ trợ gan, mật'],
      ['support-nerves', 'Hỗ trợ não, thần kinh'],
      ['support-respiratory', 'Hỗ trợ tai, mũi, họng'],
      ['support-blood', 'Hỗ trợ tạo máu'],
      ['support-digestive', 'Hỗ trợ tiêu hóa, ăn ngon'],
      ['support-cardio', 'Hỗ trợ tim, mạch'],
      ['support-vitality', 'Hỗ trợ sinh lý, sức khỏe nữ giới'],
      ['supp-vitamins', 'Bổ sung vitamin, khoáng chất'],
      ['support-immunity', 'Hỗ trợ sức đề kháng'],
    ]],
    ['devices', 'Thiết bị và vật tư y tế', [
      ['dressings', 'Băng, gạc và vật tư tiêu hao'],
      ['tests', 'Que thử thai'],
      ['cooling', 'Miếng dán, khăn làm mát'],
      ['nasal-care', 'Dụng cụ và dung dịch vệ sinh mũi'],
      ['eye-care', 'Chăm sóc mắt, nước mắt nhân tạo'],
      ['scar-device', 'Gel silicone chăm sóc sẹo'],
    ]],
    ['beauty', 'Dược mỹ phẩm, chăm sóc cá nhân', [
      ['face-cleanser', 'Làm sạch da mặt'],
      ['moisturiser', 'Dưỡng ẩm, phục hồi da'],
      ['acne-scar', 'Chăm sóc da mụn, thâm, sẹo'],
      ['sun-care', 'Chống nắng'],
      ['body-hair', 'Chăm sóc cơ thể, tóc'],
      ['baby-care', 'Chăm sóc da em bé'],
      ['intimate-care', 'Vệ sinh phụ nữ'],
      ['oral-care', 'Vệ sinh răng miệng'],
    ]],
    ['daily', 'Sản phẩm chăm sóc hằng ngày', [
      ['balms', 'Miếng dán, dầu, cao xoa'],
      ['repellent', 'Chống muỗi, côn trùng'],
      ['sexual-health', 'Sức khỏe giới tính'],
      ['food', 'Thực phẩm bổ sung, đồ uống'],
    ]],
  ].map(([id, label, children]) => ({id, label, children: children.map(([id, label]) => ({id, label}))}));

  // One primary browsing group per product, kept separate from the Sheet sync.
  const assignments = {
    pain: '1353 1358 1371 2461 2522 3513 4131 5691 6822 7127 7410 8539 10769 12076 12878 12907 13761 13768 16245 58888 68505 72195 93759 15675 62586 90100 157973 170938 212610 601729 899054 2014877',
    joints: '1125 1126 2799 3183 13001 14073',
    diabetes: '1926 2494 4370 5484 6939 7076 8281 11067 12897 2014238 2017173',
    liver: '1483 7130',
    allergy: '4687 5349 8375 10369 11602 13759 15191 15887 15896 69856 70499',
    antimicrobial: '1225 1286 1317 1320 1323 1619 1829 1903 2165 2424 2534 2631 2660 2780 2900 2975 3030 3102 3332 3561 3720 3896 3924 5497 6995 7656 7867 8463 9241 11178 12899 12925 12944 12999 13502 13755 15890 53581 54525 58031 63818 69531 69752 70502 70505 72112 80962 84262 88994 114514 349792 349814 682973 2009934 2016739',
    eyes: '1399 1652 3595 11347 15519 14719 81188 80806 87366 87775 108706 170948 551763',
    blood: '1895 6887 7008 9929 10704 70088 70014 80546 68667 220989 400941 400946 400949 1253485 2027054',
    nerves: '1251 1738 2331 2471 2859 3212 3262 3458 4146 5090 5511 6842 11498 60754 334112 335046 2002592',
    hormones: '5830 9671 9903 13767 16047 80786',
    gynaecology: '3172 8161 9365 16191 78106',
    respiratory: '1653 2282 2616 2892 2931 2970 3012 3343 3760 4496 4968 5777 5778 8131 8141 9692 9947 10335 11097 11124 12567 13111 13758 14943 14974 15052 66089 67825 82278 90016 91710 103903 153525 750253 2017403 2024889',
    digestive: '1505 1504 1511 1532 1539 1794 2180 2198 2307 2481 2567 2764 3826 5283 5488 6048 6156 7030 12150 12609 13019 13760 13769 14887 15462 56848 70527 72196 72197 72435 107400 153505 163614 439916 704407 1066384 2012842 2017161 2017859',
    cardio: '1591 1633 1857 1912 2543 2775 3446 4876 6645 7697 7945 7946 7981 8272 9334 10074 12750 12926 12972 12977 13011 13429 13763 13764 13766 14791 15910 16183 51793 68765 69075 69076 69078 69087 69109 69111 70118 70121 91471 1034145 1263661 2016649',
    skin: '1146 1145 1153 1737 2986 3268 3538 7850 8456 12105 13018 14642 80804 80850 82832 88046 101952 120703 336186 368191 431727 567944 598964 2015724 2016615 2024641 2017404',
    urinary: '1249',
    'med-vitamins': '1113 1824 2251 2513 5045 5420 7149 8229 12901 13004 15084 69858 315677 2017207',
    'support-joints': '10554 86215 89362 102483 2002702 2010131 2012666',
    'support-liver': '10562 252422 2014890',
    'support-nerves': '87132 119173 691165 851419',
    'support-respiratory': '2683 4102 7091 9985 80919 88828 255137',
    'support-blood': '86482 86961 2002866 2021326',
    'support-digestive': '2604 6580 59485 59486 70760 88829 2019889 2019036',
    'support-cardio': '2691 70718 89128',
    'support-vitality': '86943 106596',
    'supp-vitamins': '3252 3851 6810 86284 89058 93679 1242392 2002701 2004446 2013396 2016446',
    'support-immunity': '1203336 2015013',
    dressings: '2204 2304 3116 58120 58121',
    tests: '71962 80664 260189 2011041 2017390',
    cooling: '6268 10771 84166 167522 387885',
    'nasal-care': '54443 54444 119184 128314 151479 151480 151484 585918',
    'eye-care': '147115 147232 147233 147242 147260 147273 170729 2024460',
    'scar-device': '1692',
    'face-cleanser': '2379 69266 77841 97130 224998 231318 2012028 2012029 2012030 2012031 2026421',
    moisturiser: '8534 10478 10514 10521 77976 225065 2005518 2011191 2012676',
    'acne-scar': '1226 4139 6221 10467 10854',
    'sun-care': '4314 382474 2013678',
    'body-hair': '79203 315622 1231756',
    'baby-care': '1898 2337 3408 3710 7058 93999 94000 94001 231541 231543 311640 1234461 2021954 2026324',
    'intimate-care': '1757 2565 2842 3000 6477 13969',
    'oral-care': '1878 2848 3338 6534 13762 84168 167518 173191 1270457',
    balms: '1897 2362 2731 2790 5722 8482 11907 11908 12443 15072 67943 74170 86563 133561 273581 1229179 2000529',
    repellent: '11734 200262',
    'sexual-health': '2008',
    food: '1655 2618 11905 11906 12927 102943 229802 229806 2008755 2009845 2009846 2023268 2023629',
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
