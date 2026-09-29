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
  assert.equal(groups.groupFor(product(1146)).id,'skin');
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
  assert.equal(departments.definitions.length,8);
  assert.equal(new Set(departments.definitions.map(d=>d.id)).size,8);
  for(const department of departments.definitions){
    assert.equal(new Set(department.productIds).size,department.productIds.length);
    for(const group of department.groups)assert.ok(leaves.has(group),group);
    for(const id of department.productIds)assert.ok(product(id),`${department.id}: ${id}`);
    assert.ok(products.some(p=>p.visible&&departments.matches(p,department.id)),department.id);
  }
});

test('one product can appear across departments while retaining its original group and data',()=>{
  const original=JSON.stringify(products);
  assert.equal(departments.matches(product(5349),'paediatrics'),true);
  assert.equal(departments.matches(product(5349),'ent'),true);
  assert.equal(departments.matches(product(5349),'dermatology'),true);
  assert.equal(departments.matches(product(5349),'internal'),true);
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
  // No automatic inclusion just because a medicine is a liquid or a small dose.
  assert.equal(departments.matches(product(90100),'paediatrics'),false);
  // The adult-only diarrhoea medicine stays outside the paediatric list.
  assert.equal(departments.matches(product(2012842),'paediatrics'),false);
  assert.equal(departments.matches(product(12567),'paediatrics'),true);
  assert.equal(departments.matches(product(899054),'paediatrics'),true);
  const unknown={...product(5349),productId:'new-5349',name:'Baby prenatal child care'};
  assert.equal(departments.departmentsFor(unknown).length,0);
  assert.equal(departments.matches(unknown,'all'),true);
  assert.equal(departments.matches(unknown,'paediatrics'),false);
});
