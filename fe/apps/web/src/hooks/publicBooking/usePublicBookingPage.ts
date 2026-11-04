"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useQueryPublicBookingPageSwr } from "@/hooks/swr"
import { isNotFoundFailure } from "@/modules/failure"
import type { DataSlot, PublicBookingPageData } from "@/modules/types"

/** Normalizes optional wire prices for the public form and its booking hook. */
const pageOf = (data: PublicBookingPageData): PublicBookingPageData => ({
    ...data,
    services: data.services.map((service) => ({ ...service, priceVnd: service.priceVnd ?? null })),
})

type UsePublicBookingPageResult = {
    data: PublicBookingPageData | null | undefined
    failed: boolean
    /** The read as a slot: loading, the shop, nothing (no such page) or failed. */
    slot: DataSlot<PublicBookingPageData>
    /** Reads the page again after a failure. */
    retry: () => void
}

/** Loads a shop anonymously and follows the existing client document-title convention. */
export const usePublicBookingPage = (slug: string): UsePublicBookingPageResult => {
    const query = useQueryPublicBookingPageSwr({ slug })
    const missing = isNotFoundFailure(query.error)
    const data = query.data == null ? query.data : pageOf(query.data)
    const t = useTranslations("workbenchBooking")
    const title = !missing && query.data ? t("publicDocTitle", { shop: query.data.shop }) : t("publicTitle")
    useEffect(() => {
        const previousTitle = document.title
        document.title = title
        return () => {
            if (document.title === title) document.title = previousTitle
        }
    }, [title])
    const failed = !missing && query.data === undefined && query.error !== undefined
    const slotOf = (): DataSlot<PublicBookingPageData> => {
        if (missing) return { isEmpty: true }
        if (failed) return { isError: true }
        return data === undefined ? { isLoading: true } : { items: data }
    }
    return {
        data: missing ? null : data,
        failed,
        slot: slotOf(),
        retry: () => void query.mutate(),
    }
}
