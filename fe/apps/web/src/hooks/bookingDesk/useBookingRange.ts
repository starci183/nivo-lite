"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useState } from "react"
import { useQueryBookingBoardSwr } from "@/hooks/swr"
import { shiftDate, weekStartOf } from "@/modules/i18n"
import { toBookingBoard } from "@/hooks/bookingBoard"
import { readError } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import type { BookingBoard } from "@/modules/types"

/** One week of the desk, in local dates; `null` asks the back end for the week of today. */
interface Week {
    readonly from: string
    readonly to: string
}

/** The view `useBookingRange` returns. */
export interface BookingRangeView {
    read: SWRResponse<
        {
            from: string
            nowMs: number
            timezone: string
            to: string
            today: string
            bookings: Array<{
                checkedIn: boolean
                conflictNote: string
                customer: string
                date: string
                depositStatus: string
                depositVnd: number
                endClock: string
                endMin: number
                endMs: number
                feeVnd: number
                holdsSlot: boolean
                id: string
                leadId: string | null
                note: string
                party: number
                phone: string | null
                priceVnd: number | null
                reschedules: number
                resourceId: string
                service: string
                serviceId: string
                source: string
                startClock: string
                startMin: number
                startMs: number
                status: string
            }>
            exceptions: Array<{
                closed: boolean
                date: string
                end: string | null
                id: string
                note: string
                resourceId: string | null
                start: string | null
            }>
            figures: {
                bookingsToday: number
                depositsPending: number
                depositsPendingVnd: number
                finished30d: number
                noShowPct30d: number | null
                utilisationPct: number | null
            }
            hours: Array<{
                end: string
                resourceId: string
                start: string
                weekday: number
            }>
            resources: Array<{
                active: boolean
                capacity: number
                color: string
                id: string
                kind: string
                name: string
                sort: number
                staffId: string | null
            }>
            services: Array<{
                active: boolean
                bufferMin: number
                description: string
                durationMin: number
                followupDays: number | null
                id: string
                name: string
                priceVnd: number | null
                resourceKind: string | null
            }>
            settings: {
                address: string
                autoConfirm: boolean
                cancelWindowHours: number
                depositPct: number
                handoffOrder: boolean
                lateCancelFeePct: number
                maxAdvanceDays: number
                minLeadMin: number
                noShowFeeVnd: number
                publicEnabled: boolean
                publicNote: string
                publicSlug: string | null
                reminderHours: Array<number>
                slotStepMin: number
                timezone: string
            }
            staff: Array<{
                id: string
                name: string
            }>
            stats: {
                doneRevenueVnd: number
                noShowPct: number
                total: number
                byResource: Array<{
                    bookedMin: number
                    name: string
                    openMin: number
                    pct: number
                    resourceId: string
                }>
                byStatus: Array<{
                    count: number
                    status: string
                }>
            }
            waitlist: Array<{
                customer: string
                fromMs: number
                id: string
                party: number
                phone: string | null
                service: string
                status: string
                toMs: number
            }>
        },
        Error
    >
    board: BookingBoard | undefined
    anchor: string
    failed: boolean
    isLoading: boolean
    isValidating: boolean
    goto: (date: string) => void
    reload: () => Promise<
        | {
              from: string
              nowMs: number
              timezone: string
              to: string
              today: string
              bookings: Array<{
                  checkedIn: boolean
                  conflictNote: string
                  customer: string
                  date: string
                  depositStatus: string
                  depositVnd: number
                  endClock: string
                  endMin: number
                  endMs: number
                  feeVnd: number
                  holdsSlot: boolean
                  id: string
                  leadId: string | null
                  note: string
                  party: number
                  phone: string | null
                  priceVnd: number | null
                  reschedules: number
                  resourceId: string
                  service: string
                  serviceId: string
                  source: string
                  startClock: string
                  startMin: number
                  startMs: number
                  status: string
              }>
              exceptions: Array<{
                  closed: boolean
                  date: string
                  end: string | null
                  id: string
                  note: string
                  resourceId: string | null
                  start: string | null
              }>
              figures: {
                  bookingsToday: number
                  depositsPending: number
                  depositsPendingVnd: number
                  finished30d: number
                  noShowPct30d: number | null
                  utilisationPct: number | null
              }
              hours: Array<{
                  end: string
                  resourceId: string
                  start: string
                  weekday: number
              }>
              resources: Array<{
                  active: boolean
                  capacity: number
                  color: string
                  id: string
                  kind: string
                  name: string
                  sort: number
                  staffId: string | null
              }>
              services: Array<{
                  active: boolean
                  bufferMin: number
                  description: string
                  durationMin: number
                  followupDays: number | null
                  id: string
                  name: string
                  priceVnd: number | null
                  resourceKind: string | null
              }>
              settings: {
                  address: string
                  autoConfirm: boolean
                  cancelWindowHours: number
                  depositPct: number
                  handoffOrder: boolean
                  lateCancelFeePct: number
                  maxAdvanceDays: number
                  minLeadMin: number
                  noShowFeeVnd: number
                  publicEnabled: boolean
                  publicNote: string
                  publicSlug: string | null
                  reminderHours: Array<number>
                  slotStepMin: number
                  timezone: string
              }
              staff: Array<{
                  id: string
                  name: string
              }>
              stats: {
                  doneRevenueVnd: number
                  noShowPct: number
                  total: number
                  byResource: Array<{
                      bookedMin: number
                      name: string
                      openMin: number
                      pct: number
                      resourceId: string
                  }>
                  byStatus: Array<{
                      count: number
                      status: string
                  }>
              }
              waitlist: Array<{
                  customer: string
                  fromMs: number
                  id: string
                  party: number
                  phone: string | null
                  service: string
                  status: string
                  toMs: number
              }>
          }
        | undefined
    >
}

/** The board of the week the owner is looking at, and the moves between weeks; SWR owns caching and keeps the last week while the next loads. */
export const useBookingRange = (isActive = true, scope = ""): BookingRangeView => {
    const [week, setWeek] = useState<Week | null>(null)
    const [anchor, setAnchor] = useState<string | null>(null)
    const swrRead = useQueryBookingBoardSwr(week ?? {}, { keepPreviousData: true }, isActive)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setWeek(null)
            setAnchor(null)
        },
    })
    const { data, isValidating, mutate } = swrRead
    const error = readError(swrRead)
    const board = data === undefined ? undefined : toBookingBoard(data)
    return {
        read: swrRead,
        board,
        anchor: anchor ?? board?.today ?? "",
        failed: error !== undefined,
        isLoading: board === undefined,
        isValidating,
        goto: (date: string) => {
            setAnchor(date)
            const from = weekStartOf(date)
            if (from !== board?.from) setWeek({ from, to: shiftDate(from, 6) })
        },
        reload: () => mutate(),
    }
}
