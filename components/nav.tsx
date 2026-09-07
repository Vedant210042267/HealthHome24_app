'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/lib/auth'

type Item = { href: string; label: string; roles: Role[] }

const ITEMS: Item[] = [
  { href: '/dashboard',   label: 'Dashboard',  roles: ['admin', 'coordinator', 'accountant', 'attendant'] },
  { href: '/attendance',  label: 'Attendance', roles: ['admin', 'coordinator', 'accountant', 'attendant'] },
  { href: '/patients',    label: 'Patients',   roles: ['admin', 'coordinator', 'accountant'] },
  { href: '/staff',       label: 'Staff',      roles: ['admin', 'coordinator', 'accountant'] },
  { href: '/allocations', label: 'Postings',   roles: ['admin', 'coordinator', 'accountant'] },
  { href: '/payroll',     label: 'Payroll',    roles: ['admin', 'coordinator', 'accountant', 'attendant'] },
  { href: '/advances',    label: 'Advances',   roles: ['admin', 'accountant', 'attendant'] },
  { href: '/billing',     label: 'Billing',    roles: ['admin', 'accountant'] },
  { href: '/reports',     label: 'Reports',    roles: ['admin', 'coordinator', 'accountant'] },
]

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = ITEMS.filter((i) => i.roles.includes(role))

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
