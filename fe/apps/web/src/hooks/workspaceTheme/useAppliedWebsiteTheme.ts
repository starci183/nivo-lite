"use client"

import { useMemo } from "react"
import { useQueryWebsiteThemeSwr } from "@/hooks/swr"
import { deriveTheme, themeOfWire, themeStyleSheet } from "@/modules/brand"
import type { AppliedWorkspaceTheme } from "./useAppliedWorkspaceTheme"

/**
 * The theme the hosted page of a shop website wears: the saved theme of the workspace behind the site key, as the same stylesheet and font
 * the console draws; null while the workspace wears the NIVO default or the read has not answered (or failed: the page keeps the NIVO colours).
 */
export const useAppliedWebsiteTheme = (siteKey: string): AppliedWorkspaceTheme | null => {
    const { data } = useQueryWebsiteThemeSwr(siteKey)
    return useMemo<AppliedWorkspaceTheme | null>(() => {
        if (data === null || data === undefined) return null
        const params = themeOfWire(data)
        return { css: themeStyleSheet(params), fontHref: deriveTheme(params).fontHref }
    }, [data])
}
