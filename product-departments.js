// Browsing suggestions reviewed against catalogue.js and the exact-ID groups in
// product-groups.js on 2026-09-29. These do not add indications or age approvals.
// Never infer a department from a new product's name, dosage form or keywords.
(() => {
  const departments = [
    {
      id: 'paediatrics', label: 'Nhi', groups: ['baby-care'],
      // Explicit child/adolescent use or child-care names in the existing catalogue.
      // Age limits remain in each product's full information (e.g. Nexium: 12+).
      productIds: '1505 5349 6268 10771 11734 12150 12567 13019 13762 54443 70499 82278 84166 84168 200262 2000529 2005518 899054',
    },
    {
      id: 'obgyn', label: 'Sản phụ khoa', groups: ['gynaecology', 'tests', 'intimate-care'],
      // Existing genital-infection, menstrual-pain or menstrual-support indications.
      // This is NOT a list of products suitable during pregnancy.
      productIds: '2522 3030 3513 7656 12944 13755 62586 70505 72112 86943 114514 2014877',
    },
    {
      id: 'ent', label: 'Tai mũi họng', groups: ['respiratory', 'support-respiratory', 'nasal-care', 'allergy'],
      // Respiratory/ENT infection indications already recorded in the catalogue.
      productIds: '1320 1323 1619 1829 2165 2631 2660 2780 2975 3102 3332 3720 3924 5497 6995 7656 7867 8463 9241 10769 11178 12925 12944 12999 13502 13755 15890 53581 54525 58031 63818 69531 69752 70502 70505 72112 84262 88994 114514',
    },
    {
      id: 'dermatology', label: 'Da liễu',
      groups: ['skin', 'allergy', 'scar-device', 'face-cleanser', 'moisturiser', 'acne-scar', 'sun-care', 'body-hair', 'baby-care'],
      // Additional products explicitly covering skin/soft-tissue infection.
      productIds: '1320 1323 1829 2631 2660 2780 2975 3102 3332 3561 3924 5497 6995 8463 9241 11178 12925 12944 12999 13502 15890 53581 54525 63818 70502 70505 72112 84262 114514',
    },
    {
      id: 'musculoskeletal', label: 'Cơ xương khớp', groups: ['joints', 'support-joints', 'balms'],
      // Joint/muscle pain, osteoporosis, rickets or osteomalacia in existing indications.
      productIds: '1113 1829 2522 3513 4131 5045 7127 7410 8229 8539 13761 13768 15675 16245 58888 62586 68505 72195 93759 212610 2014877',
    },
    {
      id: 'neurology', label: 'Thần kinh', groups: ['nerves', 'support-nerves'],
      // Post-stroke spasticity and vitamin-related neuropathy already documented.
      productIds: '1125 1126 1824 15084',
    },
    {
      id: 'ophthalmology', label: 'Mắt', groups: ['eyes', 'eye-care'],
      // Vitamin-A-deficiency night blindness and ocular allergy in existing indications.
      productIds: '5045 8229 70499',
    },
    {
      id: 'internal', label: 'Nội chung',
      groups: ['diabetes', 'liver', 'blood', 'digestive', 'cardio', 'urinary', 'respiratory', 'allergy', 'pain', 'antimicrobial', 'med-vitamins', 'support-liver', 'support-blood', 'support-digestive', 'support-cardio', 'supp-vitamins', 'support-immunity'],
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
  window.ANTIN_DEPARTMENTS = {definitions, departmentsFor, matches, labelFor};
})();
