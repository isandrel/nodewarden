import assert from 'node:assert/strict';
import test from 'node:test';

import { readNullableFullUpdateField } from '../src/handlers/cipher-full-update';

test('omitted nullable fields are cleared during a full cipher update', () => {
  assert.equal(readNullableFullUpdateField({}, ['notes', 'Notes']), null);
  assert.equal(readNullableFullUpdateField(null, ['notes', 'Notes']), null);
});

test('explicit nullish values are normalized to null', () => {
  assert.equal(readNullableFullUpdateField({ notes: null }, ['notes', 'Notes']), null);
  assert.equal(readNullableFullUpdateField({ Notes: undefined }, ['notes', 'Notes']), null);
});

test('camelCase and PascalCase aliases preserve supplied encrypted values', () => {
  assert.equal(
    readNullableFullUpdateField({ notes: '2.encrypted-notes' }, ['notes', 'Notes']),
    '2.encrypted-notes'
  );
  assert.deepEqual(
    readNullableFullUpdateField({ Fields: [{ name: '2.name', value: '2.value' }] }, ['fields', 'Fields']),
    [{ name: '2.name', value: '2.value' }]
  );
});

test('inherited aliases are not accepted as client input', () => {
  const source = Object.create({ notes: '2.inherited' }) as Record<string, unknown>;
  assert.equal(readNullableFullUpdateField(source, ['notes', 'Notes']), null);
});
