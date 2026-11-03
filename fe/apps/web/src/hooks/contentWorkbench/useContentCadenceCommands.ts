"use client"
import type { ApplyContentCadencePresetsView, SaveContentCadenceView } from "@/hooks/content"
import { useApplyContentCadencePresets, useSaveContentCadence } from "@/hooks/content"
import type { ContentViewInput, SettingsFormReset } from "./contentWorkbench.shared"
import { useContentSettingsLifetime } from "./useContentSettingsLifetime"

/** The view `useContentCadenceCommands` returns. */
export interface ContentCadenceCommandsView {
    save: SaveContentCadenceView
    presets: ApplyContentCadencePresetsView
}

/** The save and the presets of the posting rhythm, on the lifetime of the settings card; the form starts again with it. */
export const useContentCadenceCommands = (
    input: ContentViewInput,
    form: SettingsFormReset,
): ContentCadenceCommandsView => {
    const lifetime = useContentSettingsLifetime(input, form.reset)
    return { save: useSaveContentCadence(lifetime), presets: useApplyContentCadencePresets(lifetime) }
}
