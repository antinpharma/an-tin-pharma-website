import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const context={window:{}};
for(const file of ['catalogue.js','product-groups.js','product-departments.js']) {
  runInNewContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),context);
}
const products=context.window.ANTIN_PRODUCTS;
const groups=context.window.ANTIN_GROUPS;
const departments=context.window.ANTIN_DEPARTMENTS;
const product=id=>products.find(p=>p.productId===String(id));

test('group navigation distinguishes medicines, supplements and supplies without changing catalogue data',()=>{
  assert.equal(groups.groupFor(product(1505)).id,'digestive');
  assert.equal(groups.groupFor(product(1146)).id,'acne-medicines');
  assert.equal(groups.groupFor(product(86215)).id,'support-joints');
  assert.equal(groups.groupFor(product(2204)).id,'dressings');
  assert.equal(groups.groupFor(product(71962)).id,'tests');
  assert.equal(groups.groupFor(product(2024460)).id,'eye-care');
  assert.equal(groups.matches(product(1505),'medicines'),true);
  assert.equal(groups.matches(product(86215),'medicines'),false);
  assert.equal(product(86215).category,'Thực phẩm chức năng');
});

test('unreviewed IDs do not inherit a group from their name or a similar ID',()=>{
  const unreviewed={...product(1505),productId:'new-1505'};
  assert.equal(groups.groupFor(unreviewed).id,'unassigned');
  assert.equal(groups.matches(unreviewed,'digestive'),false);
  assert.equal(groups.matches(unreviewed,'unassigned'),true);
  assert.equal(groups.matches(unreviewed,'all'),true);
});

test('all visible products belong to exactly one leaf and parent totals have no duplicate products',()=>{
  const leaves=groups.sections.flatMap(section=>section.children.map(g=>g.id)).concat('unassigned');
  assert.equal(new Set(leaves).size,leaves.length);
  for(const p of products.filter(p=>p.visible)){
    assert.equal(leaves.filter(id=>groups.matches(p,id)).length,1,p.productId);
  }
  for(const section of groups.sections){
    assert.equal(products.filter(p=>groups.matches(p,section.id)).length,
      section.children.reduce((n,g)=>n+products.filter(p=>groups.matches(p,g.id)).length,0));
  }
});

test('department definitions only reference reviewed groups and existing exact Product IDs',()=>{
  const leaves=new Set(groups.sections.flatMap(section=>section.children.map(g=>g.id)));
  assert.equal(new Set(departments.definitions.map(d=>d.id)).size,departments.definitions.length);
  for(const id of ['cardiology','gastroenterology','endocrinology','urology','dentistry','infectious','psychiatry']) {
    assert.ok(departments.definitions.some(d=>d.id===id),id);
  }
  for(const department of departments.definitions){
    assert.equal(new Set(department.productIds).size,department.productIds.length);
    for(const group of department.groups)assert.ok(leaves.has(group),group);
    for(const id of department.productIds)assert.ok(product(id),`${department.id}: ${id}`);
    assert.ok(products.some(p=>p.visible&&departments.matches(p,department.id)),department.id);
  }
});

test('one product can appear across departments while retaining its original group and data',()=>{
  const original=JSON.stringify(products);
  assert.equal(departments.matches(product(5349),'paediatrics'),false);
  assert.equal(departments.matches(product(5349),'ent'),true);
  assert.equal(departments.matches(product(5349),'dermatology'),true);
  assert.equal(departments.matches(product(5349),'internal'),false);
  assert.equal(groups.groupFor(product(5349)).id,'allergy');
  assert.equal(departments.matches(product(1125),'neurology'),true);
  assert.equal(departments.matches(product(1125),'musculoskeletal'),true);
  for(const p of products){
    const ids=departments.departmentsFor(p).map(d=>d.id);
    assert.equal(new Set(ids).size,ids.length,p.productId);
    assert.equal(departments.matches(p,'all'),true);
  }
  assert.equal(JSON.stringify(products),original);
});

test('department browsing never infers child or pregnancy use from names and contraindication words',()=>{
  // Skin products warning against pregnancy must not enter obstetrics on that keyword.
  assert.equal(departments.matches(product(2024641),'obgyn'),false);
  assert.equal(departments.matches(product(368191),'obgyn'),false);
  // Profen's paediatric use was checked against the manufacturer's catalogue;
  // it is explicitly assigned, not inferred just because it is a liquid.
  assert.equal(departments.matches(product(90100),'paediatrics'),true);
  assert.equal(departments.matches(product(899054),'paediatrics'),true);
  for(const id of [1505,13019,2000529,387885])assert.equal(departments.matches(product(id),'paediatrics'),false,String(id));
  // The adult-only diarrhoea medicine stays outside the paediatric list.
  assert.equal(departments.matches(product(2012842),'paediatrics'),false);
  assert.equal(departments.matches(product(12567),'paediatrics'),true);
  assert.equal(departments.matches(product(899054),'paediatrics'),true);
  const unknown={...product(5349),productId:'new-5349',name:'Baby prenatal child care'};
  assert.equal(departments.departmentsFor(unknown).length,0);
  assert.equal(departments.matches(unknown,'all'),true);
  assert.equal(departments.matches(unknown,'paediatrics'),false);
});

test('reviewed medicines separate antitussives, systemic steroids, topical analgesics and anticoagulants',()=>{
  for(const [id,expected] of [[10769,'respiratory'],[1353,'corticosteroids'],[3010,'corticosteroids'],
    [1358,'anti-oedema'],[2000529,'topical-pain'],[1897,'topical-pain'],[9927,'antithrombotic'],
    [2027054,'antithrombotic'],[70088,'blood'],[2009934,'antiviral'],[171743,'antiparasitic'],
    [91721,'antimicrobial'],[15922,'diabetes'],[101861,'cardio'],[13716,'lipids'],
    [516455,'intestinal'],[86504,'probiotic-medicines'],[2024682,'psychiatry'],[7685,'veins'],
    [6270,'skin'],[9165,'acne-scar'],[94627,'scar-device'],[3017,'supp-vitamins'],
    [10908,'oral-devices'],[8800,'nasal-care'],[10517,'baby-care'],[76928,'supp-vitamins']]) {
    assert.equal(groups.groupFor(product(id)).id,expected,String(id));
  }
  assert.equal(groups.matches(product(1897),'daily'),false);
  assert.equal(groups.matches(product(1897),'medicines'),true);
  assert.equal(groups.matches(product(3017),'medicines'),false);
});

test('specialties use primary purpose instead of every secondary indication or deficiency',()=>{
  for(const id of [1320,1323,1829,2631,91721,1326]) {
    assert.equal(departments.matches(product(id),'dermatology'),false,String(id));
    assert.equal(departments.matches(product(id),'ent'),false,String(id));
    assert.equal(departments.matches(product(id),'infectious'),true,String(id));
  }
  for(const [id,department] of [[91721,'infectious'],[1286,'dentistry'],[1505,'gastroenterology'],
    [15922,'endocrinology'],[2027054,'cardiology'],[5830,'urology'],[2000785,'psychiatry'],
    [76928,'obgyn'],[516455,'paediatrics'],[68684,'paediatrics'],[1399,'ophthalmology']]) {
    assert.equal(departments.matches(product(id),department),true,`${id}: ${department}`);
  }
  for(const id of [5045,8229,70499])assert.equal(departments.matches(product(id),'ophthalmology'),false,String(id));
  assert.equal(departments.matches(product(2000785),'neurology'),false);
  assert.equal(departments.matches(product(106596),'obgyn'),false);
});

test('facet counts match combined results and respect the caller’s search/category subset',()=>{
  const subset=[product(1505),product(5349),product(1146),product(1320),product(10517),product(516455)];
  for(const selectedGroup of ['all','medicines','acne-medicines','baby-care','antimicrobial']) {
    for(const selectedDepartment of ['all','dermatology','paediatrics','gastroenterology']) {
      const {groupCounts,departmentCounts}=departments.facetCounts(subset,selectedGroup,selectedDepartment);
      const selected=subset.filter(p=>groups.matches(p,selectedGroup)&&departments.matches(p,selectedDepartment));
      assert.equal(groupCounts[selectedGroup]||0,selected.length);
      assert.equal(departmentCounts[selectedDepartment]||0,selected.length);
      assert.equal(groupCounts.all,subset.filter(p=>departments.matches(p,selectedDepartment)).length);
      assert.equal(departmentCounts.all,subset.filter(p=>groups.matches(p,selectedGroup)).length);
    }
  }
  assert.equal(departments.facetCounts(subset,'antimicrobial').departmentCounts.dermatology||0,0);
  assert.equal(departments.facetCounts([]).groupCounts.all,0);
});
