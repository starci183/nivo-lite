"use client"
import { useContentBrandCardView } from "./useContentBrandCardView"
import { useContentCadenceCardView } from "./useContentCadenceCardView"
import { useContentPillarsCardView } from "./useContentPillarsCardView"
import { useContentAutomationCardView } from "./useContentAutomationCardView"
import type { ContentSelectedViewInput } from "./contentWorkbench.shared"

/** The four settings forms share only their actual settings-tab activation, not mutation state. */
export const useContentSettingsViews = (input: ContentSelectedViewInput) => {
    const active = { ...input, isActive: input.isActive && input.selected === "settings" }
    const brand = useContentBrandCardView(active)
    const cadence = useContentCadenceCardView(active)
    const pillars = useContentPillarsCardView(active)
    const automation = useContentAutomationCardView(active)
    return {
        props:
            brand.props !== undefined &&
            cadence.props !== undefined &&
            pillars.props !== undefined &&
            automation.props !== undefined
                ? { brand: brand.props, cadence: cadence.props, pillars: pillars.props, automation: automation.props }
                : undefined,
        on: { brand: brand.on, cadence: cadence.on, pillars: pillars.on, automation: automation.on },
    }
}
