import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker from '../worker.js'

test('API requests never fall through to SPA assets when the upstream is missing', async () => {
  const env = { ASSETS: { fetch: () => assert.fail('API reached SPA assets') } }
  for (const path of ['/api', '/api/v1/auth/me']) {
    const response = await worker.fetch(new Request(`https://cbms.workers.dev${path}`), env)
    assert.equal(response.status, 503)
    assert.match(response.headers.get('content-type'), /application\/json/)
  }
})

test('page navigation and assets use the static asset binding', async () => {
  for (const path of ['/orders', '/assets/app.js', '/apiary']) {
    const request = new Request(`https://cbms.workers.dev${path}`)
    const expected = new Response('asset')
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: (received) => {
          assert.equal(received, request)
          return expected
        },
      },
    })
    assert.equal(response, expected)
  }
})
