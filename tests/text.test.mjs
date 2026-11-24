import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cleanText, splitSections } from '../app/text.mjs';

test('preserves paragraphs, CRLF, short text, and meaningful fractions', () => {
  const source = 'AI\r\n\r\nYes\r\n\r\nA score of 9/10.';
  assert.equal(cleanText(source), 'AI\n\nYes\n\nA score of 9/10.');
  assert.equal(splitSections(cleanText(source)).length, 3);
});

test('HTML paragraphs remain separate and script/style contents are removed', () => {
  assert.equal(cleanText('<p>First.</p><script>alert(1)</script><style>p{}</style><p>Second.</p>'), 'First.\n\nSecond.');
  assert.equal(cleanText('Use 2 < 3 and 5 > 4.'), 'Use 2 < 3 and 5 > 4.');
});

test('markup cleanup keeps identifiers, arithmetic and escaped entities', () => {
  assert.equal(cleanText('Call my_var_name with 2 * 3 * 4.'), 'Call my_var_name with 2 * 3 * 4.');
  assert.equal(cleanText('Use **bold**, *a*, and _it_ here.'), 'Use bold, a, and it here.');
  assert.equal(cleanText('Write &amp;lt;b&amp;gt; literally.'), 'Write &lt;b&gt; literally.');
});

test('publication timestamps do not leave partial dates or times', () => {
  for (const marker of ['13:06', '9:05', '1. April 2026, 13:06', '01.04.2026 13:06', '1.']) {
    assert.equal(cleanText(`Publiziert ${marker}\nArticle content.`), 'Article content.');
  }
});

test('long sections preserve every word around ordinals, decimals and tails', () => {
  const source = ('On 30. April the reading was 2.5 units. ').repeat(40) + 'Unpunctuated tail';
  const sections = splitSections(source);
  assert.ok(sections.length > 1);
  assert.equal(sections.map(s => s.text).join(' '), source);
  assert.ok(sections.every(s => s.wordCount <= 200));
});

test('bounds long unpunctuated paragraphs even with multiple paragraphs', () => {
  const paragraph = Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ');
  const sections = splitSections(`${paragraph}\n\n${paragraph}`);
  assert.ok(sections.every(s => s.wordCount <= 200));
  assert.equal(sections.map(s => s.text).join(' '), `${paragraph} ${paragraph}`);
});

test('unfinished numeric citations cannot freeze the UI through backtracking', () => {
  const source = new URL('../app/text.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { cleanText } from ${JSON.stringify(source)}; cleanText('[' + '9'.repeat(1000));`
  ], { timeout: 3000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr.toString());
  assert.equal(cleanText('Fact [1, 2,3] [4 5].'), 'Fact .');
});

test('very long unpunctuated input does not overflow the argument stack', () => {
  const source = Array(150000).fill('word').join(' ');
  const sections = splitSections(source);
  assert.equal(sections.map(s => s.text).join(' '), source);
  assert.ok(sections.every(s => s.wordCount <= 200));
});
