import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const context={window:{}};
for(const file of ['catalogue.js','product-groups.js']) {
  runInNewContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),context);
}
const products=context.window.ANTIN_PRODUCTS;
const groups=context.window.ANTIN_GROUPS;
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
