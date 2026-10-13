"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import {
    useMutateCheckInShiftsSwr,
    useMutateRequestShiftsLeaveSwr,
    useMutateRequestShiftsSwapSwr,
    useMutateSubmitShiftsAvailabilitySwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshShifts } from "./shiftsCommands.shared"

/** An availability window a person sends for approval. */
interface ShiftsOwnAvailabilityInput {
    readonly weekday: number | null
    readonly date: string | null
    readonly start: string
    readonly end: string
    readonly available: boolean
    readonly note: string
}

/** The commands of one signed-in person. A failure was toasted with the back end words; the answer is `false` then. */
interface ShiftsMineCommands {
    readonly checkIn: (shiftId: string) => Promise<boolean>
    readonly requestSwap: (shiftId: string, toStaffId: string, reason: string) => Promise<boolean>
    readonly claimShift: (shiftId: string) => Promise<boolean>
    readonly requestLeave: (from: string, to: string, reason: string) => Promise<boolean>
    readonly sendAvailability: (input: ShiftsOwnAvailabilityInput) => Promise<boolean>
}

/** The "my schedule" commands of the Shifts workbench through the back end GraphQL API, toasted, with the reads revalidated. */
export const useShiftsMineCommands = (): ShiftsMineCommands => {
    const t = useTranslations("shifts")
    const tToast = useTranslations("toast")
    const run = useGraphQLWithToast()
    const checking = useMutateCheckInShiftsSwr()
    const swapping = useMutateRequestShiftsSwapSwr()
    const leaving = useMutateRequestShiftsLeaveSwr()
    const availability = useMutateSubmitShiftsAvailabilitySwr()

    const tell = useCallback(
        async (status: string, done: string, sent: string): Promise<void> => {
            toast.success(tToast("successTitle"), { description: status === "done" ? done : sent })
            await refreshShifts()
        },
        [tToast],
    )
    const checkIn = useCallback(
        async (shiftId: string): Promise<boolean> => {
            const result = await run(() => checking.trigger({ shiftId }), { successMessage: t("checkedInOk") })
            await refreshShifts()
            return result !== undefined
        },
        [run, checking, t],
    )
    const requestSwap = useCallback(
        async (shiftId: string, toStaffId: string, reason: string): Promise<boolean> => {
            const result = await run(() => swapping.trigger({ kind: "swap", shiftId, toStaffId, reason }), {
                showSuccessToast: false,
            })
            if (result === undefined) return false
            await tell(result.status, t("swapDone"), t("swapSent"))
            return true
        },
        [run, swapping, tell, t],
    )
    const claimShift = useCallback(
        async (shiftId: string): Promise<boolean> => {
            const result = await run(() => swapping.trigger({ kind: "claim", shiftId, reason: "" }), {
                showSuccessToast: false,
            })
            if (result === undefined) return false
            await tell(result.status, t("claimDone"), t("claimSent"))
            return true
        },
        [run, swapping, tell, t],
    )
    const requestLeave = useCallback(
        async (from: string, to: string, reason: string): Promise<boolean> => {
            const result = await run(() => leaving.trigger({ from, to: to || from, reason }), {
                showSuccessToast: false,
            })
            if (result === undefined) return false
            await tell(result.status, t("leaveDone"), t("leaveSent"))
            return true
        },
        [run, leaving, tell, t],
    )
    const sendAvailability = useCallback(
        async (input: ShiftsOwnAvailabilityInput): Promise<boolean> => {
            const result = await run(() => availability.trigger(input), { successMessage: t("availSent") })
            await refreshShifts()
            return result !== undefined
        },
        [run, availability, t],
    )
    return { checkIn, requestSwap, claimShift, requestLeave, sendAvailability }
}
