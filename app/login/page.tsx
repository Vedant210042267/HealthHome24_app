import { Suspense } from 'react'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            H
          </div>
          <h1 className="text-lg font-semibold text-slate-900">HealthHome24</h1>
          <p className="mt-1 text-sm text-slate-500">Home-care operations, Mumbai</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
