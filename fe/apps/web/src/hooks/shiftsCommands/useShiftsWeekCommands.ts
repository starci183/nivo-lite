"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import {
    useMutateExplainShiftsScheduleSwr,
    useMutateProposeShiftsWeekSwr,
    useMutateReassignShiftsShiftSwr,
    useMutateRequestShiftsPublishSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshShifts } from "./shiftsCommands.shared"
import { useShiftsSaved } from "./useShiftsSaved"

/** The schedule commands of one week. A failure was toasted with the back end words; the answer is `undefined` / `false` then. */
interface ShiftsWeekCommands {
    /** Builds a draft of the week; answers the id of the new schedule. */
    readonly propose: (week: string) => Promise<string | undefined>
    /** Has the back end write the explanation of a schedule. */
    readonly explain: (scheduleId: string) => Promise<boolean>
    /** Gives a shift to a person (`null` = open shift). */
    readonly reassign: (shiftId: string, staffId: string | null) => Promise<boolean>
    /** Publishes a draft, or sends it to the owner to approve. */
    readonly publish: (scheduleId: string) => Promise<boolean>
}

/** The week commands of the Shifts workbench through the back end GraphQL API, toasted, with the reads revalidated on success. */
export const useShiftsWeekCommands = (): ShiftsWeekCommands => {
    const t = useTranslations("shifts")
    const tToast = useTranslations("toast")
    const run = useGraphQLWithToast()
    const finish = useShiftsSaved()
    const proposing = useMutateProposeShiftsWeekSwr()
    const explaining = useMutateExplainShiftsScheduleSwr()
    const reassigning = useMutateReassignShiftsShiftSwr()
    const publishing = useMutateRequestShiftsPublishSwr()

    const propose = useCallback(
        async (week: string): Promise<string | undefined> => {
            const result = await run(() => proposing.trigger({ week }), { showSuccessToast: false })
            if (result === undefined) return undefined
            await refreshShifts()
            return result.scheduleId
        },
        [run, proposing],
    )
    const explain = useCallback(
        async (scheduleId: string): Promise<boolean> => {
            const result = await run(() => explaining.trigger({ scheduleId }))
            await refreshShifts()
            return result !== undefined
        },
        [run, explaining],
    )
    const reassign = useCallback(
        (shiftId: string, staffId: string | null): Promise<boolean> =>
            finish(() => reassigning.trigger({ shiftId, staffId })),
        [finish, reassigning],
    )
    const publish = useCallback(
        async (scheduleId: string): Promise<boolean> => {
            const result = await run(() => publishing.trigger({ scheduleId }), { showSuccessToast: false })
            if (result === undefined) return false
            toast.success(tToast("successTitle"), {
                description: t(result.status === "done" ? "publishedNow" : "publishAsked"),
            })
            await refreshShifts()
            return true
        },
        [run, publishing, t, tToast],
    )
    return { propose, explain, reassign, publish }
}
