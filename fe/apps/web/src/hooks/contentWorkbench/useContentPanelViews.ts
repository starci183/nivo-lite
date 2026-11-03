"use client"
import { whenSelected } from "@/modules/utils"
import { useContentCalendarPanelView } from "./useContentCalendarPanelView"
import { useContentListPanelView } from "./useContentListPanelView"
import { useContentQueuePanelView } from "./useContentQueuePanelView"
import { useContentBalancePanelView } from "./useContentBalancePanelView"
import type { ContentSelectedViewInput } from "./contentWorkbench.shared"
import type {
    ContentWorkbenchCopy,
    PostView,
    ContentListFields,
    ContentQueueFields,
    ContentBalanceFields,
    ContentListActions,
    ContentQueueActions,
    ContentBalanceActions,
} from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { ContentNote } from "@/hooks/content"

/** The view `useContentPanelViews` returns. */
export interface ContentPanelViewsView {
    props:
        | {
              calendar: {
                  copy: ContentWorkbenchCopy
                  weekdays: string[]
                  y: number
                  m: number
                  title: string
                  cells: (
                      | {
                            label: string
                            posts: {
                                pickLabel: string
                                id: string
                                title: string
                                time: string
                                when: string
                                brief: string | null
                                statusLabel: string
                                tone: BadgeTone
                                isSkipped: boolean
                                canMove: boolean
                                channels: ReadonlyArray<string>
                                pillar: string | null
                            }[]
                            moreLabel: string | null
                            key: string
                            day: number
                            dateKey: string
                        }
                      | {
                            label: string
                            posts: {
                                pickLabel: string
                                id: string
                                title: string
                                time: string
                                when: string
                                brief: string | null
                                statusLabel: string
                                tone: BadgeTone
                                isSkipped: boolean
                                canMove: boolean
                                channels: ReadonlyArray<string>
                                pillar: string | null
                            }[]
                            moreLabel: string | null
                            key: string
                            day: null
                            dateKey: string
                        }
                  )[]
                  monthItems: PostView[]
                  isMonthEmpty: boolean
                  unscheduled: PostView[]
                  todayKey: string
                  pickedId: string | null
                  overKey: string | null
                  expandedKey: string | null
                  canManage: boolean
                  isEmptySetup: boolean
                  note: ContentNote | null
              }
              list: ContentListFields
              queue: ContentQueueFields
              balance: ContentBalanceFields
          }
        | undefined
    loading: {
        calendar: {
            weekdays: string[]
            y: number
            m: number
            title: string
            todayKey: string
        }
        balance: {
            y: number
            m: number
            monthTitle: string
            title: string
        }
    }
    on: {
        calendar: {
            shift: (by: number) => void
            today: () => void
            open: (id: string) => void
            dragStart: (id: string) => void
            pick: (id: string) => void
            dragEnd: () => void
            dragOver: (key: string) => void
            dragLeave: (key: string) => void
            drop: (day: number) => void
            expand: (key: string) => void
            dismissNote: () => void
        }
        list: ContentListActions
        queue: ContentQueueActions
        balance: ContentBalanceActions
    }
}

/** Owns the four mutually exclusive panel controllers without retaining inactive drafts or drag state. */
export const useContentPanelViews = (input: ContentSelectedViewInput): ContentPanelViewsView => {
    const calendar = useContentCalendarPanelView(whenSelected(input, "calendar"))
    const list = useContentListPanelView(whenSelected(input, "list"))
    const queue = useContentQueuePanelView(whenSelected(input, "queue"))
    const balance = useContentBalancePanelView(whenSelected(input, "balance"))
    return {
        props:
            calendar.props !== undefined &&
            list.props !== undefined &&
            queue.props !== undefined &&
            balance.props !== undefined
                ? { calendar: calendar.props, list: list.props, queue: queue.props, balance: balance.props }
                : undefined,
        loading: { calendar: calendar.loading, balance: balance.loading },
        on: { calendar: calendar.on, list: list.on, queue: queue.on, balance: balance.on },
    }
}
