import { useMemo } from "react"
import { useQueryPublicHiringOfferSwr } from "@/hooks/swr/api/graphql/queries/useQueryPublicHiringOfferSwr"
import { toPublicOffer } from "./hiringPublic.shared"

/** The job offer of a link token, read without a session; `isMissing` when the link is not valid any more. */
export const usePublicHiringOffer = (token: string) => {
    const read = useQueryPublicHiringOfferSwr({ token })
    const view = useMemo(() => (read.data === undefined ? undefined : toPublicOffer(read.data)), [read.data])
    return { view, isLoading: read.isLoading, isMissing: read.error !== undefined }
}
