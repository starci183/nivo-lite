"use client"
import { useFeatureReset } from "@/hooks/reuseables"
import { contentSettingsLifetimeOf, type ContentViewInput } from "./contentWorkbench.shared"

/** The view `useContentSettingsLifetime` returns. */
export interface ContentSettingsLifetimeView {
    isActive: boolean
    scope: string
}

/** The lifetime the commands of a settings card follow; the form starts again whenever it changes. */
export const useContentSettingsLifetime = (input: ContentViewInput, reset: () => void): ContentSettingsLifetimeView => {
    useFeatureReset({ isActive: input.isActive, isReady: input.isReady, scope: input.scope, onReset: reset })
    return contentSettingsLifetimeOf(input)
}
