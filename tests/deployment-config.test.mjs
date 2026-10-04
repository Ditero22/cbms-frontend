import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { resolveApiBase } from '../vite.config.ts'

const wranglerConfigText = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
const wranglerConfig = JSON.parse(wranglerConfigText.replace(/,\s*([}\]])/g, '$1'))

test('Cloudflare previews use the staging API origin', () => {
  const stagingApiOrigin = 'https://cbms-backend-staging.onrender.com'

  assert.equal(wranglerConfig.vars.CBMS_API_ORIGIN, stagingApiOrigin)
  assert.equal(wranglerConfig.previews.vars.CBMS_API_ORIGIN, stagingApiOrigin)
})

test('production API traffic uses the same-origin proxy', () => {
  for (const value of [undefined, '', '   ', '/api/v1', ' /api/v1/ ']) {
    assert.equal(resolveApiBase(value, true).replace(/\/+$/, ''), '/api/v1')
  }
})

test('production rejects absolute API URLs before bundling browser requests', () => {
  for (const value of [
    'http://localhost:3000/api/v1',
    'http://127.0.0.1:3000/api/v1',
    'http://[::1]:3000/api/v1',
    'https://api.example.invalid/api/v1',
  ]) {
    assert.throws(() => resolveApiBase(value, true), /Production VITE_API_URL must be \/api\/v1/)
  }
})

test('development can use an explicit HTTP(S) backend', () => {
  for (const value of ['http://localhost:3000/api/v1', 'https://api.example.invalid/api/v1']) {
    assert.equal(resolveApiBase(value, false), value)
  }
})

test('invalid API configuration is rejected without disclosing its value', () => {
  for (const value of [
    '//api.example.invalid/api/v1',
    'api/v1',
    '/api/v2',
    'file:///api/v1',
    'https://fixture:fixture-only@api.example.invalid/api/v1',
    '/api/v1?fixture=value',
    '/api/v1#fixture',
  ]) {
    assert.throws(
      () => resolveApiBase(value, false),
      (error) => {
        assert.ok(error instanceof Error)
        assert.doesNotMatch(error.message, /fixture|api\.example\.invalid/)
        return /VITE_API_URL/.test(error.message)
      },
    )
  }
})
