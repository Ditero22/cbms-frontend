export const passwordRules = [
  { key: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { key: 'uppercase', label: 'An uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { key: 'lowercase', label: 'A lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { key: 'number', label: 'A number', test: (value: string) => /[0-9]/.test(value) },
  {
    key: 'special',
    label: 'A special character',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const

export function isStrongPassword(value: string) {
  return passwordRules.every((rule) => rule.test(value)) && value.length <= 128
}
