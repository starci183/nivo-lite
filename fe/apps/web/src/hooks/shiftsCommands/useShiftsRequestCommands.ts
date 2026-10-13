"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateDecideShiftsAvailabilitySwr } from "@/hooks/swr/api/graphql/mutations/useMutateDecideShiftsAvailabilitySwr"
import { useMutateDecideWorkItemSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDecideWorkItemSwr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshShifts } from "./shiftsCommands.shared"
import { useShiftsSaved } from "./useShiftsSaved"

/** The decisions a manager takes on staff requests. A failure was toasted with the back end words; the answer is `false` then. */
interface ShiftsRequestCommands {
    /** Approves or declines the agent work item behind a leave or swap request. */
    readonly decideItem: (workItemId: string, decision: "approved" | "rejected") => Promise<boolean>
    /** Approves or declines an availability change. */
    readonly decideAvailability: (id: string, approve: boolean) => Promise<boolean>
}

/** The request decisions of the Shifts workbench through the back end GraphQL API, toasted, with the reads revalidated on success. */
export const useShiftsRequestCommands = (): ShiftsRequestCommands => {
    const tToast = useTranslations("toast")
    const run = useGraphQLWithToast()
    const finish = useShiftsSaved()
    const deciding = useMutateDecideWorkItemSwr()
    const availability = useMutateDecideShiftsAvailabilitySwr()

    const decideItem = useCallback(
        async (workItemId: string, decision: "approved" | "rejected"): Promise<boolean> => {
            const result = await run(() => deciding.trigger({ workItemId, decision }), { showSuccessToast: false })
            if (result === undefined) return false
            toast.success(tToast("successTitle"), { description: tToast("defaultSuccess") })
            await refreshShifts()
            return true
        },
        [run, deciding, tToast],
    )
    const decideAvailability = useCallback(
        (id: string, approve: boolean): Promise<boolean> => finish(() => availability.trigger({ id, approve })),
        [finish, availability],
    )
    return { decideItem, decideAvailability }
}
