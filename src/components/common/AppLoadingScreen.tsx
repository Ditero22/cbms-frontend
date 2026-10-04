import './loading.css'

export function AppLoadingScreen() {
  return (
    <main className="app-loading-screen" role="status" aria-live="polite">
      <span className="app-loading-spinner" aria-hidden="true" />
      <h1>Opening Materials Supply Operations &amp; Finance</h1>
      <p>Please wait while we prepare your session.</p>
    </main>
  )
}
