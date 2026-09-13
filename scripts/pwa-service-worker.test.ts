import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../webapp/vite.config.ts', import.meta.url), 'utf8');
const navigationStart = source.indexOf('async function appShellNavigation(request)');
const navigationEnd = source.indexOf('\nasync function connectorNavigation', navigationStart);
const navigation = source.slice(navigationStart, navigationEnd);

test('PWA navigation fetches online shells before using the offline fallback', () => {
  assert.ok(navigationStart >= 0 && navigationEnd > navigationStart, 'navigation strategy is present');
  assert.ok(navigation.indexOf('const response = await fetch(request)') < navigation.indexOf('catch {'));
  assert.match(navigation, /await cache\.put\('\/', response\.clone\(\)\)/);
  assert.match(navigation, /await cache\.match\('\/'\)/);
  assert.match(source, /Offline cache is not ready on this device/);
});

test('PWA cache version changes when the navigation strategy changes', () => {
  assert.match(source, /PWA_CACHE_STRATEGY_VERSION = 'network-first-navigation-v2'/);
  assert.ok(source.includes('PWA_CACHE_STRATEGY_VERSION}\\n${urls.join'), 'strategy marker contributes to the cache version');
});
