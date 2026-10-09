'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)].map(m => m[1]).filter(Boolean);
const script = scripts.join('\\n');
function functionSource(name, nextName) {
  const start = script.indexOf('function ' + name + '(');
  const end = script.indexOf('function ' + nextName + '(', start + 1);
  assert.ok(start >= 0 && end > start, name + ' must exist before ' + nextName);
  return script.slice(start, end);
}
const helperSource = functionSource('aiFailureMessage', 'showAiRetry');
const message = vm.runInNewContext(helperSource + '\\naiFailureMessage');

test('HTML has a document, title and deal container', () => {
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>Albert/i);
  assert.match(html, /id="deals-container"/);
});
test('all inline JavaScript parses', () => {
  for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code));
});
test('all seven deal cards are present', () => {
  for (const name of ['RADAR', 'CIPHER', 'ORACLE', 'QUANTUM', 'VERDICT', 'PRODUKTPORTRÄT', 'ZIELGRUPPEN']) {
    assert.ok(script.includes(name), 'missing ' + name);
  }
});
test('deal view reloads data and preserves expansion state', () => {
  assert.match(script, /async function fetchDeals\\(/);
  assert.match(script, /const dealExpansion = new Map\\(/);
  assert.match(script, /isDealExpanded\\(deal\\.id, activeDealView\\)/);
});
test('portrait results are cached on success', () => {
  assert.match(script, /const portraitCache = new Map\\(/);
  assert.match(script, /portraitCache\\.set\\(key, data\\.portrait\\)/);
  assert.match(script, /portraitCache\\.has\\(key\\)/);
});
test('audience results are cached on success', () => {
  assert.match(script, /const audienceCache = new Map\\(/);
  assert.match(script, /audienceCache\\.set\\(key,/);
  assert.match(script, /audienceCache\\.has\\(key\\)/);
});
test('in-flight AI request flags are cleared even on failure', () => {
  assert.match(script, /finally\\s*\\{\\s*portraitRequests\\.delete\\(key\\)/);
  assert.match(script, /finally\\s*\\{\\s*audienceRequests\\.delete\\(key\\)/);
});
test('AI cards offer manual retry without auto-retry timers', () => {
  assert.match(script, /function showAiRetry\\(/);
  assert.match(script, /Erneut versuchen/);
  assert.match(script, /showAiRetry\\(current,/);
  assert.match(script, /showAiRetry\\(node,/);
});
test('error classification: overload', () => {
  assert.match(message({status:429}, 'Test'), /ausgelastet/);
});
test('error classification: timeout', () => {
  assert.match(message({status:504}, 'Test'), /zu lange/);
});
test('error classification: network/server failure', () => {
  assert.match(message({status:503}, 'Test'), /nicht erreichbar/);
});
test('error classification: fallback', () => {
  assert.match(message(new Error('unexpected'), 'Test'), /nicht abgeschlossen/);
});
test('deal loading errors are handled', () => {
  assert.match(script, /Fehler beim Laden der Deals/);
  assert.match(script, /if \\(error\\)/);
});
test('retry button invokes callback only when clicked', () => {
  const source = functionSource('showAiRetry', 'loadProductPortrait');
  const listeners = [];
  const document = { createElement: tag => ({
    tag, textContent: '', className: '', type: '',
    addEventListener: (name, fn, opts) => listeners.push({name, fn, opts})
  }) };
  const show = vm.runInNewContext(source + '\\nshowAiRetry', {document});
  const target = { replaceChildren() { this.cleared = true; }, append(...nodes) { this.nodes = nodes; } };
  let called = 0;
  show(target, 'Testfehler', () => called++);
  assert.equal(target.cleared, true);
  assert.equal(target.nodes[0].textContent, 'Testfehler');
  assert.equal(target.nodes[1].textContent, 'Erneut versuchen ↻');
  assert.equal(called, 0);
  assert.equal(listeners[0].opts.once, true);
  listeners[0].fn();
  assert.equal(called, 1);
});
