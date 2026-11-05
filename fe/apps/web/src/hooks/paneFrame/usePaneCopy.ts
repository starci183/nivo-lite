"use client"

import { useTranslations } from "next-intl"

/** The words every list and detail frame shares, resolved once. */
interface PaneCopy {
    readonly backToList: string
    readonly refresh: string
    readonly moreActions: string
    readonly closeAside: string
    /** The "+n" menu name of a filter row, with `{count}` where the number goes. */
    readonly moreFilters: string
    readonly clearFilters: string
    readonly clearSearch: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly errorTitle: string
    readonly errorBody: string
    readonly retry: string
    readonly forbiddenTitle: string
}

/** The words every list and detail frame shares: back to the list, the shared states. */
export const usePaneCopy = (): PaneCopy => {
    const t = useTranslations("pane")
    return {
        backToList: t("backToList"),
        refresh: t("refresh"),
        moreActions: t("moreActions"),
        closeAside: t("closeAside"),
        moreFilters: String(t.raw("moreFilters")),
        clearFilters: t("clearFilters"),
        clearSearch: t("clearSearch"),
        noMatchTitle: t("noMatchTitle"),
        noMatchBody: t("noMatchBody"),
        errorTitle: t("errorTitle"),
        errorBody: t("errorBody"),
        retry: t("retry"),
        forbiddenTitle: t("forbiddenTitle"),
    }
}
