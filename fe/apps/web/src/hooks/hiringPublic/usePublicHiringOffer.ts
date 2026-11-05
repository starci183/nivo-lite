"use client"

import { useMemo } from "react"
import { useQueryPublicHiringOfferSwr } from "@/hooks/swr"
import { toPublicOffer, type PublicOfferView, failureFlagsOf } from "./hiringPublic.shared"

/** The view `usePublicHiringOffer` returns. */
export interface PublicHiringOfferView {
    view: PublicOfferView | undefined
    isLoading: boolean
    isMissing: boolean
    /** The read failed for a reason other than a missing link (the network, the server). */
    isFailed: boolean
    reload: () => void
}

/** The job offer of a link token, read without a session; `isMissing` when the link is not valid any more. */
export const usePublicHiringOffer = (token: string): PublicHiringOfferView => {
    const read = useQueryPublicHiringOfferSwr({ token })
    const view = useMemo(() => (read.data === undefined ? undefined : toPublicOffer(read.data)), [read.data])
    const reload = () => {
        void read.mutate()
    }
    return {
        view,
        isLoading: read.isLoading,
        ...failureFlagsOf(read.error),
        reload,
    }
}
