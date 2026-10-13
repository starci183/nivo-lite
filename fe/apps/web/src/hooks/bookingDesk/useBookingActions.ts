"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import {
    isQueryBookingBoardSwrKey,
    useMutateCancelBookingSwr,
    useMutateCheckInBookingSwr,
    useMutateCompleteBookingSwr,
    useMutateConfirmBookingSwr,
    useMutateMarkBookingNoShowSwr,
} from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import type { BookingAction } from "@/modules/types"
import { NOTICE_OF_ACTION } from "./bookingDesk.shared"
import type { DeskNotice } from "./bookingDesk.shared"

/** The owner's commands on bookings; every answer becomes a toast and revalidates every cached board. */
export const useBookingActions = (onChanged: () => void) => {
    const t = useTranslations("workbenchBooking")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const confirm = useMutateConfirmBookingSwr()
    const checkIn = useMutateCheckInBookingSwr()
    const done = useMutateCompleteBookingSwr()
    const noShow = useMutateMarkBookingNoShowSwr()
    const cancel = useMutateCancelBookingSwr()
    const [notice, setNotice] = useState<DeskNotice | null>(null)
    const [isBusy, startTransition] = useTransition()

    const triggers: Readonly<Record<BookingAction, (arg: { id: string }) => Promise<unknown>>> = {
        confirm: (arg) => confirm.trigger(arg),
        "check-in": (arg) => checkIn.trigger(arg),
        done: (arg) => done.trigger(arg),
        "no-show": (arg) => noShow.trigger(arg),
        cancel: (arg) => cancel.trigger(arg),
    }

    return {
        notice,
        isBusy,
        dismiss: () => setNotice(null),
        announce: (code: string, tone: DeskNotice["tone"] = "affirmative") => setNotice({ tone, code }),
        act: (id: string, action: BookingAction, finish: () => void) =>
            startTransition(async () => {
                const answer = await withToast(() => triggers[action]({ id }), {
                    successMessage: t(NOTICE_OF_ACTION[action]),
                })
                if (answer === undefined) return
                finish()
                void mutate(isQueryBookingBoardSwrKey)
                onChanged()
            }),
    }
}
