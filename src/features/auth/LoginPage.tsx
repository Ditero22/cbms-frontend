import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, BriefcaseBusiness, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('Enter a valid work email'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginValues = z.infer<typeof loginSchema>

type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<void>
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit(async ({ email, password }) => {
    try {
      await onLogin(email, password)
      toast.success('Signed in to CBMS.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign-in failed.')
    }
  })

  return (
    <main className="login-page">
      <div className="login-brand">
        <div className="brand-mark">
          <BriefcaseBusiness size={23} strokeWidth={1.8} />
        </div>
        <div>
          <strong>BuildCore</strong>
          <span>CONSTRUCTION MANAGEMENT</span>
        </div>
      </div>
      <section className="login-card">
        <div className="login-eyebrow">
          <span className="eyebrow-mark">
            <ShieldCheck size={15} />
          </span>
          BUSINESS OPERATIONS PLATFORM
        </div>
        <h1>Welcome back</h1>
        <p className="login-lead">Sign in to your CBMS workspace to keep your projects moving.</p>
        <form onSubmit={submit} className="login-form">
          <label className="field-label">
            Work email
            <input
              className="form-input"
              type="email"
              autoComplete="username"
              {...register('email')}
            />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>
          <label className="field-label">
            Password
            <input
              className="form-input"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </label>
          <button className="button button-primary login-submit" disabled={isSubmitting}>
            Sign in <ArrowUpRight size={17} />
          </button>
        </form>
      </section>
      <footer className="login-footer">
        © 2026 BuildCore Construction Management
        <span>
          Secure workspace <ShieldCheck size={13} />
        </span>
      </footer>
    </main>
  )
}
