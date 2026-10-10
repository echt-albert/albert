import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Scanner deals keep an orange border even after offer_url becomes a real link',()=>{
 assert.match(html,/data-scanner-import="\$\{deal\.hunt_origin==='SCANNER'\|\|String\(deal\.offer_url\|\|''\)\.startsWith\('scanner:\/\/import\/'\)\}"/);
 assert.match(html,/article\[data-scanner-import="true"\]\s*\{\s*border:2px solid #f97316\s*!important/);
});
test('Sofortjagd deals keep a blue border in compact and expanded cards',()=>{
 assert.match(html,/data-deal-origin="\$\{deal\.hunt_origin==='SOFORT'\?'sofort':'other'\}"/);
 assert.match(html,/article\[data-deal-origin="sofort"\]\s*\{border:2px solid #24a1d6!important/);
});
