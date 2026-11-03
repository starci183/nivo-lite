"use client"
import type { HiringSelectedViewInput } from "./hiringWorkbench.shared"

import { useHiringSettingsView } from "./useHiringSettingsView"
import { useHiringAvailabilityView } from "./useHiringAvailabilityView"
import type { HiringWorkbenchCopy, FieldOf } from "@/modules/types"
import type { SettingsValues } from "@/hooks/hiringSettings"

/** The view `useHiringSettingsViews` returns. */
export interface HiringSettingsViewsView {
    props: {
        settings: {
            copy: HiringWorkbenchCopy
            slugHint: string
            values: SettingsValues
            retentionMin: number
            retentionMax: number
            isBusy: boolean
            error: string | null
            notice: string | null
        }
        availability: {
            copy: HiringWorkbenchCopy
            members: {
                id: string
                label: string
            }[]
            who: string
            days: {
                weekday: number
                label: string
                text: string
                isInvalid: boolean
            }[]
            canSave: boolean
            isBusy: boolean
            error: string | null
            notice: string | null
        }
    }
    on: {
        settings: {
            readonly text: (name: FieldOf<SettingsValues, string>, value: string) => void
            readonly number: (name: FieldOf<SettingsValues, number>, value: number) => void
            readonly flag: (name: FieldOf<SettingsValues, boolean>, value: boolean) => void
            readonly save: () => void
        }
        availability: {
            readonly member: (id: string) => void
            readonly text: (weekday: number, text: string) => void
            readonly save: () => void
        }
    }
}

/** Settings and availability retain their shared old mount, separately owned forms and feedback. */
export const useHiringSettingsViews = (input: HiringSelectedViewInput): HiringSettingsViewsView => {
    const owner = { ...input, isActive: input.isActive && input.selected === "settings" }
    const settings = useHiringSettingsView(owner)
    const availability = useHiringAvailabilityView(owner)
    return {
        props: { settings: settings.props, availability: availability.props },
        on: { settings: settings.on, availability: availability.on },
    }
}
