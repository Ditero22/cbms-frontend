import './loading.css'

export function AppLoadingScreen() {
  return (
    <main className="app-loading-screen" role="status" aria-live="polite">
      <span className="app-loading-spinner" aria-hidden="true" />
      <h1>Connecting to CBMS workspace</h1>
      <p>Please wait while we prepare your session.</p>
    </main>
  )
}
