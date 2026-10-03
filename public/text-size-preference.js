/* global window, document */
;(() => {
  try {
    const userId = window.localStorage.getItem('cbms-last-user-id')
    const preference = userId
      ? window.localStorage.getItem(`cbms-text-size:${userId}`)
      : null
    document.documentElement.dataset.textSize = /^[1-5]$/.test(preference ?? '')
      ? preference
      : '3'
  } catch {
    document.documentElement.dataset.textSize = '3'
  }
})()
