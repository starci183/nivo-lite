"use client"
import type { ApplyContentPillarPresetsView, SaveContentPillarsView } from "@/hooks/content"
import { useApplyContentPillarPresets, useSaveContentPillars } from "@/hooks/content"
import type { ContentViewInput, SettingsFormReset } from "./contentWorkbench.shared"
import { useContentSettingsLifetime } from "./useContentSettingsLifetime"

/** The view `useContentPillarsCommands` returns. */
export interface ContentPillarsCommandsView {
    save: SaveContentPillarsView
    presets: ApplyContentPillarPresetsView
}

/** The save and the presets of the themes, on the lifetime of the settings card; the form starts again with it. */
export const useContentPillarsCommands = (
    input: ContentViewInput,
    form: SettingsFormReset,
): ContentPillarsCommandsView => {
    const lifetime = useContentSettingsLifetime(input, form.reset)
    return { save: useSaveContentPillars(lifetime), presets: useApplyContentPillarPresets(lifetime) }
}
