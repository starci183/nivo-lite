"use client"

import { useMemo, useState } from "react"
import { useQueryWorkspaceThemeSwr } from "@/hooks/swr"
import {
    hexToOklch,
    oklchToHex,
    themeFontOf,
    themeOfWire,
    themeRadiusOf,
    themeScopeSheet,
    type ThemeParams,
} from "@/modules/brand"
import { useWorkspaceThemeCommands } from "./useWorkspaceThemeCommands"

/** The class the preview frame wears, and the one selector its scoped stylesheet is written for. */
const PREVIEW_SCOPE_CLASS = "nivo-theme-preview"

/** The draft of the theme tab: what the controls show and the commands they run. */
export interface ThemeDraftView {
    readonly draft: ThemeParams
    /** The draft's accent as `#rrggbb`, for the colour control. */
    readonly accentHex: string
    readonly mode: "light" | "dark"
    /** The class of the preview frame and the stylesheet that paints the draft inside it. */
    readonly scopeClass: string
    readonly scopeCss: string
    readonly isPending: boolean
    readonly setAccentHex: (hex: string) => void
    readonly setBase: (value: number) => void
    readonly setFont: (value: string) => void
    readonly setRadius: (value: string) => void
    readonly setMode: (value: "light" | "dark") => void
    readonly save: () => void
    readonly reset: () => void
}

/**
 * The draft of the workspace theme: it starts from the saved theme (or the NIVO default), every control changes it and the preview
 * paints it at once; `save` writes it, `reset` removes the saved theme. Both drop the draft once the back end answered.
 */
export const useThemeDraft = (): ThemeDraftView => {
    const read = useQueryWorkspaceThemeSwr()
    const { saveTheme, resetTheme, isPending } = useWorkspaceThemeCommands()
    const [edited, setEdited] = useState<ThemeParams | null>(null)
    const [mode, setMode] = useState<"light" | "dark">("light")
    const saved = useMemo(() => themeOfWire(read.data), [read.data])
    const draft = edited ?? saved
    const change = (next: Partial<ThemeParams>): void => setEdited({ ...draft, ...next })
    const scopeCss = useMemo(() => themeScopeSheet(draft, mode, `.${PREVIEW_SCOPE_CLASS}`), [draft, mode])
    const dropDraft = (done: boolean): void => {
        if (done) setEdited(null)
    }
    return {
        draft,
        accentHex: oklchToHex(draft.lightness, draft.chroma, draft.hue),
        mode,
        scopeClass: PREVIEW_SCOPE_CLASS,
        scopeCss,
        isPending,
        setAccentHex: (hex) => {
            const accent = hexToOklch(hex)
            if (accent !== null) change(accent)
        },
        setBase: (value) => change({ base: value }),
        setFont: (value) => change({ font: themeFontOf(value) }),
        setRadius: (value) => change({ radius: themeRadiusOf(value) }),
        setMode,
        save: () => void saveTheme(draft).then(dropDraft),
        reset: () => void resetTheme().then(dropDraft),
    }
}
