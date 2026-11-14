import { useQueryCreditPacksBoughtSwr, useQueryCreditTopupLotsSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"

/** The view `useCreditsLedger` returns. */
export interface CreditsLedgerView {
    lots:
        | {
              credits: number
              priceVnd: number
              purchasedAt: string
              expiresAt: string
              creditsRemaining: number
          }[]
        | undefined
    bought:
        | {
              credits: number
              priceVnd: number
              purchasedAt: string
          }[]
        | undefined
    isReady: boolean
    error: unknown
    refresh: () => Promise<void>
}

/** The credits a workspace added on top of its plan: legacy top-up lots (managers only) and this month's add-on packs. */
export const useCreditsLedger = (workspaceId: string | undefined, canSeeLots: boolean): CreditsLedgerView => {
    const lots = useQueryCreditTopupLotsSwr(workspaceId, canSeeLots)
    const bought = useQueryCreditPacksBoughtSwr(workspaceId)
    const lotsError = canSeeLots ? readError(lots) : undefined
    return {
        lots: lots.data,
        bought: bought.data,
        isReady: (!canSeeLots || lots.data !== undefined) && bought.data !== undefined,
        error: lotsError ?? readError(bought),
        refresh: async () => {
            await Promise.all([...(canSeeLots ? [lots.mutate()] : []), bought.mutate()])
        },
    }
}
