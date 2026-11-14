"use client"

import { useContext, useEffect } from "react"
import { ReadFreshnessContext, freshnessOf, isProviderRead } from "@/modules/workbench-host"

/**
 * Tells the page around a provider read how fresh its answer is (`source`, `asOf`), when a page listens for it. The answer is the first
 * page the read gave: the pages loaded after it carry no note of their own. A module read states none and reports nothing.
 */
export const useReportReadFreshness = (operation: string, answer: unknown): void => {
    const report = useContext(ReadFreshnessContext)
    const freshness = isProviderRead(operation) ? freshnessOf(answer) : null
    const source = freshness?.source
    const asOf = freshness?.asOf
    useEffect(() => {
        if (report === null || source === undefined) return undefined
        report(operation, { source, asOf: asOf ?? null })
        return () => report(operation, null)
    }, [report, operation, source, asOf])
}
