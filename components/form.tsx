'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'
import { Button, ErrorNote, SuccessNote } from '@/components/ui'
import type { ActionState } from '@/actions/types'

export function SubmitButton({
  children,
  variant = 'primary',
  className,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className}>
      {pending ? 'Saving…' : children}
    </Button>
  )
}

/**
 * Thin wrapper so every mutating form reports the database's own error message.
 * The schema raises human-readable exceptions (locked payroll, overlapping duty,
 * bad mobile number) and they are more useful than anything invented here.
 */
export function ActionForm({
  action,
  children,
  className = '',
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  children: ReactNode | ((state: ActionState) => ReactNode)
  className?: string
}) {
  const [state, formAction] = useActionState(action, {})
  return (
    <form action={formAction} className={className}>
      {typeof children === 'function' ? children(state) : children}
      {(state.error || state.ok) && (
        <div className="mt-3 space-y-2">
          <ErrorNote>{state.error}</ErrorNote>
          <SuccessNote>{state.ok}</SuccessNote>
        </div>
      )}
    </form>
  )
}
