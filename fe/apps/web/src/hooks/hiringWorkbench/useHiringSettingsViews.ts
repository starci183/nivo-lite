"use client"
import type { HiringSelectedViewInput } from "./hiringWorkbench.shared"

import { useHiringSettingsView } from "./useHiringSettingsView"
import { useHiringAvailabilityView } from "./useHiringAvailabilityView"

/** Settings and availability retain their shared old mount, separately owned forms and feedback. */
export const useHiringSettingsViews = (input: HiringSelectedViewInput) => {
    const owner = { ...input, isActive: input.isActive && input.selected === "settings" }
    const settings = useHiringSettingsView(owner)
    const availability = useHiringAvailabilityView(owner)
    return {
        props: { settings: settings.props, availability: availability.props },
        on: { settings: settings.on, availability: availability.on },
    }
}
