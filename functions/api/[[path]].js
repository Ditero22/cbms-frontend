const jsonResponse = (status, message) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  })

function getApiOrigin(value) {
  if (typeof value !== 'string' || value.length === 0) return null

  try {
    const origin = new URL(value)
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    ) {
      return null
    }
    return origin
  } catch {
    return null
  }
}

export async function onRequest({ request, env }) {
  const apiOrigin = getApiOrigin(env.CBMS_API_ORIGIN)
  if (!apiOrigin) {
    return jsonResponse(503, 'The application API is not configured for this site.')
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin)
  const headers = new Headers(request.headers)
  const connectingIp = headers.get('cf-connecting-ip')

  for (const name of [
    'connection',
    'content-length',
    'forwarded',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'x-forwarded-for',
    'x-real-ip',
  ]) {
    headers.delete(name)
  }

  if (connectingIp) headers.set('x-forwarded-for', connectingIp)

  try {
    const requestWithTrustedHeaders = new Request(request, { headers })
    const upstreamRequest = new Request(upstreamUrl, requestWithTrustedHeaders)
    return await fetch(upstreamRequest)
  } catch {
    return jsonResponse(502, 'The application API is temporarily unavailable.')
  }
}
