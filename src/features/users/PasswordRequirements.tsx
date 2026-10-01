import { passwordRules } from './password-policy'

export function PasswordRequirements({ value, id }: { value: string; id?: string }) {
  return (
    <div id={id} className="password-requirements" aria-label="Password requirements">
      <span className="form-helper">Use a password with:</span>
      <ul>
        {passwordRules.map((rule) => {
          const satisfied = rule.test(value)
          return (
            <li key={rule.key} className={satisfied ? 'is-satisfied' : undefined}>
              <span aria-hidden="true">{satisfied ? '✓' : '•'}</span> {rule.label}
            </li>
          )
        })}
        {value.length > 128 && <li className="is-error">Maximum 128 characters</li>}
      </ul>
    </div>
  )
}
