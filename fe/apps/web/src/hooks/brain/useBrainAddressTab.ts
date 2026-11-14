"use client"

import { useSearchParams } from "next/navigation"
import { brainTabOf } from "@/modules/brain"
import type { BrainTab } from "@/modules/routes"

/**
 * The tab of the Second Brain the address opens, read in the browser. A route's `loading.tsx` receives no search params, so the page
 * drawn there in its loading state asks the address for the tab it will land on (`?tab=`, `?view=`), the same way the page owner does.
 */
export const useBrainAddressTab = (): BrainTab => {
    const params = useSearchParams()
    return brainTabOf({
        tab: params.get("tab") ?? undefined,
        view: params.get("view") ?? undefined,
        fact: params.get("fact") ?? undefined,
        edit: params.get("edit") ?? undefined,
        answer: params.get("answer") ?? undefined,
    })
}
