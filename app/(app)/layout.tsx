import { requireProfile } from '@/lib/auth'
import { Nav } from '@/components/nav'
import { signOut } from '@/actions/auth'
import { titleCase } from '@/lib/format'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile()

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            H
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">HealthHome24</div>
            <div className="truncate text-xs text-slate-500">Mumbai</div>
          </div>
        </div>

        <div className="px-2 pb-3">
          <Nav role={profile.role} />
        </div>

        <div className="hidden border-t border-slate-100 px-4 py-3 md:block">
          <div className="truncate text-sm font-medium text-slate-900">{profile.full_name}</div>
          <div className="text-xs text-slate-500">{titleCase(profile.role)}</div>
          <form action={signOut}>
            <button className="mt-2 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  )
}
