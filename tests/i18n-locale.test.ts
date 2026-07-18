import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLocalePreference } from '../webapp/src/lib/i18n';

const browserLanguageCases = [
  { languages: ['en-US', 'zh-CN'], expected: 'en' },
  { languages: ['zh-TW', 'en-US'], expected: 'zh-TW' },
  { languages: ['de-DE', 'en-US'], expected: 'de' },
  { languages: ['xx-XX', 'en-US'], expected: 'en' },
  { languages: ['xx-XX'], expected: 'en' },
  { languages: ['zh-HK', 'en-US'], expected: 'zh-TW' },
  { languages: ['zh-Hans', 'en-US'], expected: 'zh-CN' },
] as const;

for (const { languages, expected } of browserLanguageCases) {
  test(`${JSON.stringify(languages)} resolves to ${expected}`, () => {
    assert.equal(resolveLocalePreference(null, languages), expected);
  });
}

test('a saved supported locale takes priority over browser languages', () => {
  assert.equal(resolveLocalePreference('fr', ['en-US', 'zh-CN']), 'fr');
});

test('every supported non-English browser language remains recognized', () => {
  assert.equal(resolveLocalePreference(null, ['ru-RU']), 'ru');
  assert.equal(resolveLocalePreference(null, ['es-ES']), 'es');
  assert.equal(resolveLocalePreference(null, ['fi-FI']), 'fi');
  assert.equal(resolveLocalePreference(null, ['fr-FR']), 'fr');
  assert.equal(resolveLocalePreference(null, ['it-IT']), 'it');
  assert.equal(resolveLocalePreference(null, ['sv-SE']), 'sv');
});
