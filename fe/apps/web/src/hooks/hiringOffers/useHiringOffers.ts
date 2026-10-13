import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import { useMutateCancelHiringOfferSwr } from "@/hooks/swr/api/graphql/mutations/useMutateCancelHiringOfferSwr"

/** The offers list: the copied letter link, the pending flag and the cancel command. */
export const useHiringOffers = () => {
    const run = useHiringRun()
    const { trigger: cancelTrigger } = useMutateCancelHiringOfferSwr()
    const { copiedId, copy } = useHiringCopy()
    return {
        copiedId,
        isPending: run.isPending,
        error: run.error,
        clearError: run.clear,
        cancelOffer: (id: string) => void run.exec(() => cancelTrigger({ id })),
        copyLink: (id: string, link: string) => void copy(id, link),
    }
}
