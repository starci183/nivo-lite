"use client"
import { useContentBrandCardView } from "./useContentBrandCardView"
import { useContentCadenceCardView } from "./useContentCadenceCardView"
import { useContentPillarsCardView } from "./useContentPillarsCardView"
import { useContentAutomationCardView } from "./useContentAutomationCardView"
import type { ContentSelectedViewInput } from "./contentWorkbench.shared"
import type {
    ContentWorkbenchCopy,
    ContentNoteView,
    AutomationKey,
    ContentChannel,
    ContentViews,
} from "@/modules/types"

/** The view `useContentSettingsViews` returns. */
export interface ContentSettingsViewsView {
    props:
        | {
              brand: {
                  copy: ContentWorkbenchCopy
                  voice: string
                  avoid: string
                  cta: string
                  tags: string
                  canManage: boolean
                  isPending: boolean
                  note: ContentNoteView | null
              }
              cadence: {
                  copy: ContentWorkbenchCopy
                  rows: {
                      channel: "zalo" | "facebook" | "instagram" | "tiktok"
                      label: string
                      on: boolean
                      perWeek: number
                      days: number[]
                      time: string
                  }[]
                  dayNames: string[]
                  canManage: boolean
                  isPending: boolean
                  note: ContentNoteView | null
              }
              pillars: {
                  copy: ContentWorkbenchCopy
                  rows: {
                      key: string
                      name: string
                      description: string
                      weight: number
                      active: boolean
                      id?: string | undefined
                  }[]
                  canManage: boolean
                  isPending: boolean
                  note: ContentNoteView | null
              }
              automation: {
                  copy: ContentWorkbenchCopy
                  rows: {
                      key: AutomationKey
                      title: string
                      body: string
                      on: boolean
                  }[]
                  canManage: boolean
                  isPending: boolean
                  note: null
              }
          }
        | undefined
    on: {
        brand: {
            voice: (value: string) => void
            avoid: (value: string) => void
            cta: (value: string) => void
            tags: (value: string) => void
            save: () => Promise<void> | undefined
            dismissNote: () => void
        }
        cadence: {
            change: (channel: ContentChannel, patch: Partial<ContentViews["cadenceRow"]>) => void
            preset: () =>
                | Promise<
                      | {
                            count: number
                        }
                      | undefined
                  >
                | undefined
            save: () => Promise<void> | undefined
            dismissNote: () => void
        }
        pillars: {
            change: (key: string, patch: Partial<ContentViews["pillarRow"]>) => void
            add: () => void
            remove: (key: string) => void
            preset: () =>
                | Promise<
                      | {
                            count: number
                        }
                      | undefined
                  >
                | undefined
            save: () => Promise<void> | undefined
            dismissNote: () => void
        }
        automation: {
            toggle: (keyInput: string, value: boolean) => Promise<void> | undefined
            dismissNote: () => void
        }
    }
}

/** The four settings forms share only their actual settings-tab activation, not mutation state. */
export const useContentSettingsViews = (input: ContentSelectedViewInput): ContentSettingsViewsView => {
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
