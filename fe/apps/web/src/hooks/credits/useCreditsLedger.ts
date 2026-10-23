import { useQueryCreditPacksBoughtSwr, useQueryCreditTopupLotsSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"

/** The credits a workspace added on top of its plan: legacy top-up lots (managers only) and this month's add-on packs. */
export const useCreditsLedger = (workspaceId: string | undefined, canSeeLots: boolean) => {
    const lots = useQueryCreditTopupLotsSwr(workspaceId, canSeeLots)
    const bought = useQueryCreditPacksBoughtSwr(workspaceId)
    return {
        lots: lots.data,
        bought: bought.data,
        isReady: (!canSeeLots || lots.data !== undefined) && bought.data !== undefined,
        error: (canSeeLots ? readError(lots) : undefined) || readError(bought),
        refresh: async () => {
            await Promise.all([...(canSeeLots ? [lots.mutate()] : []), bought.mutate()])
        },
    }
}
