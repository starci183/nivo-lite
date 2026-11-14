"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateUpdateWorkspaceSettingsSwr, useQueryMyWorkspacesSwr, useQueryWorkspaceSettingsSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The view `useWorkspaceSettingsCommands` returns. */
export interface WorkspaceSettingsCommandsView {
    saveSettings: (name: string, timeZone: string) => Promise<boolean>
    isSaving: boolean
}

/**
 * The workspace settings write that goes through the back end, toasted (the failure with the server-localized message):
 * `saveSettings` saves the name and the time zone, then reads the settings and the person's workspaces again (the top bar and the
 * workspace list take the workspace name from the latter). It answers whether it worked.
 */
export const useWorkspaceSettingsCommands = (): WorkspaceSettingsCommandsView => {
    const t = useTranslations("settings")
    const runGraphQL = useGraphQLWithToast()
    const update = useMutateUpdateWorkspaceSettingsSwr()
    const { mutate: refreshSettings } = useQueryWorkspaceSettingsSwr()
    const { mutate: refreshWorkspaces } = useQueryMyWorkspacesSwr()
    const saveSettings = useCallback(
        async (name: string, timeZone: string): Promise<boolean> => {
            const saved = await runGraphQL(() => update.trigger({ name, timeZone }), { successMessage: t("saved") })
            if (saved === undefined) return false
            await Promise.all([refreshSettings(), refreshWorkspaces()])
            return true
        },
        [runGraphQL, update, refreshSettings, refreshWorkspaces, t],
    )
    return { saveSettings, isSaving: update.isMutating }
}
