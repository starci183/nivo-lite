"use client"

import { useTranslations } from "next-intl"
import type { FactsPagingView } from "@/modules/types"

/** The words of the paging footer of the facts list. */
export interface FactsPageWords {
    readonly nav: string
    readonly previous: string
    readonly next: string
    /** "Trang {page}" with the page left to fill in. */
    readonly pageTemplate: string
    /** The span of the total, already worded; empty when there is no paging. */
    readonly summary: string
}

/** The words of the pager under the facts list, with the span of the page shown. */
export const useFactsPageWords = (paging: FactsPagingView | null): FactsPageWords => {
    const t = useTranslations("brainTruths")
    return {
        nav: t("factsPagerNav"),
        previous: t("factsPagerPrevious"),
        next: t("factsPagerNext"),
        pageTemplate: t("factsPagerPage", { page: "{page}" }),
        summary:
            paging === null ? "" : t("factsPagerSummary", { from: paging.from, to: paging.to, total: paging.total }),
    }
}
