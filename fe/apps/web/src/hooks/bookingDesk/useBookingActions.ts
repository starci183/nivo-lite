"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSWRConfig } from "swr"
import {
    QUERY_BOOKING_BOARD_SWR_KEY,
    useMutateCancelBookingSwr,
    useMutateCheckInBookingSwr,
    useMutateCompleteBookingSwr,
    useMutateConfirmBookingSwr,
    useMutateMarkBookingNoShowSwr,
} from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { useGraphQLWithToast } from "@/modules/toast"
import type { BookingAction } from "@/modules/types"
import { NOTICE_OF_ACTION } from "@/modules/booking-desk"
import { useBookingTransition } from "./useBookingTransition"
import type { DeskNotice } from "./bookingDesk.shared"

/** The owner's commands on bookings; every answer becomes a toast and revalidates every cached board. */
export const useBookingActions = (onChanged: () => Promise<unknown>, isActive = true, scope = "") => {
    const t = useTranslations("workbenchBooking")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const confirm = useMutateConfirmBookingSwr()
    const checkIn = useMutateCheckInBookingSwr()
    const done = useMutateCompleteBookingSwr()
    const noShow = useMutateMarkBookingNoShowSwr()
    const cancel = useMutateCancelBookingSwr()
    const [notice, setNotice] = useState<DeskNotice | null>(null)
    const transition = useBookingTransition(isActive, scope)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setNotice(null)
        },
    })

    const triggers: Readonly<Record<BookingAction, (arg: { id: string }) => Promise<unknown>>> = {
        confirm: (arg) => confirm.trigger(arg),
        "check-in": (arg) => checkIn.trigger(arg),
        done: (arg) => done.trigger(arg),
        "no-show": (arg) => noShow.trigger(arg),
        cancel: (arg) => cancel.trigger(arg),
    }

    return {
        notice,
        isBusy: transition.isPending,
        dismiss: () => setNotice(null),
        announce: (code: string, tone: DeskNotice["tone"] = "affirmative") => setNotice({ tone, code }),
        act: (id: string, action: BookingAction, finish: () => void) =>
            transition.run(async (isCurrent) => {
                const answer = await withToast(() => triggers[action]({ id }), {
                    successMessage: t(NOTICE_OF_ACTION[action]),
                })
                if (answer === undefined) return
                if (isCurrent()) finish()
                await withToast(
                    () =>
                        Promise.all([
                            mutate(matchesSwrKey(QUERY_BOOKING_BOARD_SWR_KEY)),
                            ...(isCurrent() ? [onChanged()] : []),
                        ]),
                    { showSuccessToast: false },
                )
            }),
    }
}
