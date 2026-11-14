"use client"

import { useEffect, useMemo } from "react"
import { useQueryWorkspaceThemeSwr } from "@/hooks/swr"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"
import {
    deriveTheme,
    forgetThemeCache,
    rememberThemeCache,
    removeThemeBoot,
    themeOfWire,
    themeStyleSheet,
} from "@/modules/brand"

/** The stylesheet and font of the theme the workspace chose. */
export interface AppliedWorkspaceTheme {
    readonly css: string
    readonly fontHref: string | null
}

/**
 * The theme the open workspace wears: its saved theme as the stylesheet to draw after `brand.css` and the font to load, or null while it
 * wears the NIVO default (or until the read answers). Once answered it replaces the boot paint of the layout and keeps (or forgets) the
 * theme in this browser for the next visit.
 */
export const useAppliedWorkspaceTheme = (): AppliedWorkspaceTheme | null => {
    const workspaceId = useOpenWorkspaceId()
    const { data } = useQueryWorkspaceThemeSwr()
    const applied = useMemo<AppliedWorkspaceTheme | null>(() => {
        if (data === null || data === undefined) return null
        const params = themeOfWire(data)
        return { css: themeStyleSheet(params), fontHref: deriveTheme(params).fontHref }
    }, [data])
    useEffect(() => {
        if (data === undefined || workspaceId === undefined) return
        removeThemeBoot()
        if (applied === null) forgetThemeCache(workspaceId)
        else rememberThemeCache(workspaceId, applied)
    }, [applied, data, workspaceId])
    return applied
}
