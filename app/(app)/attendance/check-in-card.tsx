'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkIn, checkOut } from '@/actions/attendance'
import { Button, ErrorNote } from '@/components/ui'

type Duty = {
  allocationId: string
  staffId: string
  patientId: string
  dutyDate: string
  attendanceId: string | null
  checkedIn: boolean
  checkedOut: boolean
}

/** Reads the device GPS, then posts it to the server action. */
export function CheckInCard({ duty }: { duty: Duty }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function withPosition(kind: 'in' | 'out') {
    setBusy(true)
    setError(null)

    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })

    const fd = new FormData()
    if (position) {
      fd.set('lat', String(position.coords.latitude))
      fd.set('lng', String(position.coords.longitude))
      fd.set('accuracy', String(Math.round(position.coords.accuracy)))
    }

    let result
    if (kind === 'in') {
      fd.set('duty_allocation_id', duty.allocationId)
      fd.set('staff_id', duty.staffId)
      fd.set('patient_id', duty.patientId)
      fd.set('duty_date', duty.dutyDate)
      result = await checkIn({}, fd)
    } else {
      fd.set('attendance_id', duty.attendanceId ?? '')
      result = await checkOut({}, fd)
    }

    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={() => withPosition('in')} disabled={busy || duty.checkedIn}>
          {duty.checkedIn ? 'Checked in' : busy ? 'Locating…' : 'Check in'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => withPosition('out')}
          disabled={busy || !duty.checkedIn || duty.checkedOut}
        >
          {duty.checkedOut ? 'Checked out' : 'Check out'}
        </Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!error && <p className="text-xs text-slate-500">Location is recorded with each punch and checked against the patient&apos;s address.</p>}
    </div>
  )
}
