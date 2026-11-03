import type { HiringOwner } from "@/hooks/hiring"
import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import { useMutateCancelHiringOfferSwr } from "@/hooks/swr"

/** The view `useHiringOffers` returns. */
export interface HiringOffersView {
    copiedId: string | null
    isPending: boolean
    error: string | null
    clearError: () => void
    cancelOffer: (id: string) => void
    copyLink: (id: string, link: string) => void
}

/** The offers list: the copied letter link, the pending flag and the cancel command. */
export const useHiringOffers = (owner?: HiringOwner): HiringOffersView => {
    const run = useHiringRun(owner)
    const { trigger: cancelTrigger } = useMutateCancelHiringOfferSwr()
    const { copiedId, copy } = useHiringCopy(owner)
    return {
        copiedId,
        isPending: run.isPending,
        error: run.error,
        clearError: run.clear,
        cancelOffer: (id: string) => run.dispatch(() => cancelTrigger({ id })),
        copyLink: (id: string, link: string) => copy(id, link),
    }
}
