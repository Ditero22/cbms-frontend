import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { onRequest } from '../functions/api/[[path]].js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('proxies API path, query, method, body, cookies, and same-origin request origin', async () => {
  let forwardedRequest
  globalThis.fetch = async (request) => {
    forwardedRequest = request
    return new Response('ok', {
      status: 200,
      headers: { 'Set-Cookie': 'cbms_session=opaque; HttpOnly; Secure; SameSite=Lax' },
    })
  }

  const request = new Request('https://cbms.pages.dev/api/v1/orders?status=open', {
    method: 'POST',
    headers: {
      Cookie: 'cbms_session=opaque',
      Origin: 'https://cbms.pages.dev',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.44',
      'X-Forwarded-For': '198.51.100.99',
      'X-Real-IP': '198.51.100.99',
    },
    body: JSON.stringify({ reference: 'ORD-STAGING-1' }),
  })

  const response = await onRequest({
    request,
    env: { CBMS_API_ORIGIN: 'https://cbms-api.onrender.com' },
  })

  assert.equal(response.status, 200)
  assert.equal(
    response.headers.get('set-cookie'),
    'cbms_session=opaque; HttpOnly; Secure; SameSite=Lax',
  )
  assert.equal(forwardedRequest.url, 'https://cbms-api.onrender.com/api/v1/orders?status=open')
  assert.equal(forwardedRequest.method, 'POST')
  assert.equal(await forwardedRequest.text(), JSON.stringify({ reference: 'ORD-STAGING-1' }))
  assert.equal(forwardedRequest.headers.get('cookie'), 'cbms_session=opaque')
  assert.equal(forwardedRequest.headers.get('origin'), 'https://cbms.pages.dev')
  assert.equal(forwardedRequest.headers.get('x-forwarded-for'), '203.0.113.44')
  assert.equal(forwardedRequest.headers.has('x-real-ip'), false)
})

test('returns a safe configuration error without calling the upstream when origin is missing or invalid', async () => {
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response()
  }

  for (const apiOrigin of [
    undefined,
    'http://cbms-api.onrender.com',
    'https://user:pass@example.com',
    'https://example.com/api',
  ]) {
    const response = await onRequest({
      request: new Request('https://cbms.pages.dev/api/v1/health'),
      env: { CBMS_API_ORIGIN: apiOrigin },
    })

    assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), {
      message: 'The CBMS API is not configured for this site.',
    })
  }

  assert.equal(fetchCalled, false)
})

test('returns a safe upstream error when the Render API cannot be reached', async () => {
  globalThis.fetch = async () => {
    throw new Error('internal upstream detail')
  }

  const response = await onRequest({
    request: new Request('https://cbms.pages.dev/api/v1/health'),
    env: { CBMS_API_ORIGIN: 'https://cbms-api.onrender.com' },
  })

  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), {
    message: 'The CBMS API is temporarily unavailable.',
  })
})
