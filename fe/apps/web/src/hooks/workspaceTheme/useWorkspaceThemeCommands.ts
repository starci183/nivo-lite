"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateResetWorkspaceThemeSwr, useMutateUpdateWorkspaceThemeSwr, useQueryWorkspaceThemeSwr } from "@/hooks/swr"
import type { ThemeParams } from "@/modules/brand"
import { useGraphQLWithToast } from "@/modules/toast"

/** The view `useWorkspaceThemeCommands` returns. */
export interface WorkspaceThemeCommandsView {
    saveTheme: (theme: ThemeParams) => Promise<boolean>
    resetTheme: () => Promise<boolean>
    isPending: boolean
}

/**
 * The workspace theme writes that go through the back end, toasted (the failure with the server-localized message): `saveTheme` saves the
 * six parameters, `resetTheme` returns the workspace to the NIVO default; both read the theme again so the console wears the new one. Each
 * answers whether it worked.
 */
export const useWorkspaceThemeCommands = (): WorkspaceThemeCommandsView => {
    const t = useTranslations("settings")
    const runGraphQL = useGraphQLWithToast()
    const update = useMutateUpdateWorkspaceThemeSwr()
    const reset = useMutateResetWorkspaceThemeSwr()
    const { mutate: refresh } = useQueryWorkspaceThemeSwr()
    const saveTheme = useCallback(
        async (theme: ThemeParams): Promise<boolean> => {
            const saved = await runGraphQL(
                () =>
                    update.trigger({
                        hue: theme.hue,
                        chroma: theme.chroma,
                        lightness: theme.lightness,
                        base: theme.base,
                        font: theme.font,
                        radius: theme.radius,
                        mode: theme.mode ?? null,
                    }),
                { successMessage: t("themeSaved") },
            )
            if (saved === undefined) return false
            await refresh()
            return true
        },
        [runGraphQL, update, refresh, t],
    )
    const resetTheme = useCallback(async (): Promise<boolean> => {
        const done = await runGraphQL(() => reset.trigger(), { successMessage: t("themeResetDone") })
        if (done === undefined) return false
        await refresh()
        return true
    }, [runGraphQL, reset, refresh, t])
    return { saveTheme, resetTheme, isPending: update.isMutating || reset.isMutating }
}
