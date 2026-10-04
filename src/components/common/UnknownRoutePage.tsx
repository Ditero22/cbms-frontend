import { Link } from 'react-router-dom'

export function UnknownRoutePage() {
  return (
    <section className="not-found" aria-labelledby="unknown-route-title">
      <div className="not-found-mark" aria-hidden="true">
        404
      </div>
      <h1 id="unknown-route-title">Page not found</h1>
      <p>We couldn’t find a CBMS page at this address. Check the address or return to overview.</p>
      <Link className="button button-primary" to="/dashboard">
        Back to overview
      </Link>
    </section>
  )
}
