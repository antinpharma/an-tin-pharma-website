// Reviewed 2026-10-24; primary sources: docs/product-filter-review.md.
// Use primary purpose and exact reviewed IDs, never keywords, pregnancy warnings
// or every possible indication of a systemic antibiotic.
(() => {
  const departments = [
    {
      id: 'paediatrics', label: 'Nhi', groups: ['baby-care'],
      // Dedicated child-care products and verified paediatric formulations.
      // Not everything with an adolescent dose. Age/weight limits still apply.
      productIds: '2683 4102 6268 7091 10554 10771 12144 12567 13762 54443 59485 59486 80945 84166 84168 88828 88829 9165 93679 102943 113280 113281 1270457 167518 167522 229802 229806 68684 899054 516455 1203336 2016446 94627 90100 157973 170938',
    },
    {
      id: 'obgyn', label: 'Sản phụ khoa', groups: ['gynaecology', 'tests', 'intimate-care'],
      // Menstrual pain/support and the specific prenatal supplement.
      // This does not approve use of other products during pregnancy.
      productIds: '3513 3916 62586 86943 76928 2008',
    },
    {
      id: 'ent', label: 'Tai mũi họng', groups: ['ent-local', 'respiratory', 'support-respiratory', 'nasal-care', 'allergy'],
      productIds: '',
    },
    {
      id: 'respiratory', label: 'Hô hấp', groups: ['respiratory', 'support-respiratory', 'asthma'], productIds: '',
    },
    {
      id: 'dermatology', label: 'Da liễu',
      groups: ['skin', 'acne-medicines', 'antifungal-skin', 'scar-device', 'face-cleanser', 'moisturiser', 'acne-scar', 'sun-care', 'body-hair', 'baby-care'],
      // Reviewed urticaria antihistamines; no automatic systemic antibiotics.
      productIds: '5349 8375 10369 11602 13759 15191 15887 15896 69856 70499 57579 77294 368117 138701',
    },
    {
      id: 'musculoskeletal', label: 'Cơ xương khớp', groups: ['joints', 'support-joints', 'topical-pain'],
      productIds: '1113 2315 1391 2522 3513 3916 4131 7127 7410 8539 11757 13761 13768 15675 16245 62586 68505 72195 93759 212610 2014877',
    },
    {
      id: 'neurology', label: 'Thần kinh', groups: ['nerves', 'support-nerves', 'dizziness'],
      productIds: '1125 1126 14073 1824 15084',
    },
    {
      id: 'psychiatry', label: 'Tâm thần', groups: ['psychiatry'], productIds: '',
    },
    {
      id: 'ophthalmology', label: 'Mắt', groups: ['eyes', 'eye-care'],
      productIds: '',
    },
    {
      id: 'cardiology', label: 'Tim mạch', groups: ['cardio', 'lipids', 'veins', 'antithrombotic', 'support-cardio'], productIds: '',
    },
    {
      id: 'gastroenterology', label: 'Tiêu hóa, gan mật',
      groups: ['digestive', 'intestinal', 'motility', 'probiotic-medicines', 'haemorrhoids', 'liver', 'support-liver', 'support-digestive'], productIds: '',
    },
    {
      id: 'endocrinology', label: 'Nội tiết, đái tháo đường', groups: ['diabetes'], productIds: '',
    },
    {
      id: 'urology', label: 'Tiết niệu, Nam khoa', groups: ['urinary', 'hormones', 'sexual-health'], productIds: '2342 106596',
    },
    {
      id: 'dentistry', label: 'Răng hàm mặt', groups: ['dental', 'oral-care', 'oral-devices'], productIds: '',
    },
    {
      id: 'infectious', label: 'Truyền nhiễm', groups: ['antimicrobial', 'antiviral', 'antiparasitic'], productIds: '',
    },
    {
      id: 'nutrition', label: 'Dinh dưỡng, vi chất',
      groups: ['med-vitamins', 'supp-vitamins', 'support-blood', 'support-immunity'],
      productIds: '1895 10704 70088 220989 10554 86215 102483 2002702 2010131 2012666',
    },
    {
      id: 'internal', label: 'Nội tổng quát',
      groups: ['pain', 'anti-oedema', 'corticosteroids', 'blood', 'med-vitamins', 'supp-vitamins'],
      productIds: '',
    },
  ];
  const definitions = departments.map(department => ({...department,
    productIds: department.productIds ? department.productIds.split(' ') : [],
  }));
  const explicitIds = new Map(definitions.map(department => [department.id, new Set(department.productIds)]));
  function departmentsFor(product) {
    const group = window.ANTIN_GROUPS.groupFor(product).id;
    return definitions.filter(department => department.groups.includes(group)
      || explicitIds.get(department.id).has(String(product.productId)));
  }
  function matches(product, selected = 'all') {
    return selected === 'all' || departmentsFor(product).some(department => department.id === selected);
  }
  function labelFor(id) {
    return definitions.find(department => department.id === id)?.label || 'Tất cả khoa';
  }
  // Facet counts include the other active facet, so each option's count equals
  // the result of selecting it, including zero. Search/category are applied first.
  function facetCounts(products, selectedGroup = 'all', selectedDepartment = 'all') {
    const groupCounts = {all: 0}, departmentCounts = {all: 0};
    const add = (counts, id) => counts[id] = (counts[id] || 0) + 1;
    for (const product of products) {
      if (matches(product, selectedDepartment)) {
        add(groupCounts, 'all');
        const group = window.ANTIN_GROUPS.groupFor(product);
        add(groupCounts, group.id);
        if (group.parent) add(groupCounts, group.parent);
      }
      if (window.ANTIN_GROUPS.matches(product, selectedGroup)) {
        add(departmentCounts, 'all');
        for (const department of departmentsFor(product)) add(departmentCounts, department.id);
      }
    }
    return {groupCounts, departmentCounts};
  }
  window.ANTIN_DEPARTMENTS = {definitions, departmentsFor, matches, facetCounts, labelFor};
})();
