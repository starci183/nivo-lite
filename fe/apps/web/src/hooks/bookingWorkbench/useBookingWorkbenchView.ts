"use client"

import { useTranslations } from "next-intl"
import { useAppSelector } from "@/redux"
import { useAgentWorkbenchShell } from "@/hooks/agentDashboard"
import { useBookingBoard } from "@/hooks/bookingBoard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    BOOKING_TABS,
    type DataSlot,
    type SlotLabels,
    type BookingAction,
    type BookingDetailFact,
    type ResourceFields,
} from "@/modules/types"
import { useBookingSetupView } from "./useBookingSetupView"
import { useBookingDeskView } from "./useBookingDeskView"
import { useBookingFiguresView } from "./useBookingFiguresView"
import { useBookingWaitlistView } from "./useBookingWaitlistView"
import { useBookingStatsView } from "./useBookingStatsView"
import type { BadgeTone } from "@starci/grammar/common"
import type { PlacementFields } from "@/hooks/bookingDesk"
import type { ServiceFields, ExceptionFields } from "@/modules/booking-desk"

type BookingTab = (typeof BOOKING_TABS)[number]

/** The required installation and route tab, with all five tab names resolved by the server page. */
interface BookingWorkbenchViewInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<BookingTab, string>>
}

/** The view `useBookingWorkbenchView` returns. */
export interface BookingWorkbenchView {
    readonly shape: "today" | "setup" | "explanation" | "calendar" | "waitlist" | "stats"
    readonly props: {
        readonly ribbon: {
            readonly label: string
            readonly slot: DataSlot<
                {
                    id: string
                    term: string
                    value: string
                    meta: string
                }[]
            >
            readonly labels: SlotLabels
            readonly placeholder: {
                id: string
                term: string
                value: string
                meta: string
            }[]
        }
        readonly desk: {
            readonly slot: DataSlot<
                | {
                      readonly cancel?: never
                      readonly placement?: never
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
                | {
                      readonly cancel: {
                          title: string
                          confirmLabel: string
                          keepLabel: string
                      }
                      readonly placement?: never
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
                | {
                      readonly cancel?: never
                      readonly placement: {
                          canForce: boolean
                          isPending: boolean
                          refusal?: string
                          mode: "add" | "move"
                          title: string
                          fields: PlacementFields
                          serviceOptions: {
                              id: string
                              label: string
                          }[]
                          resourceOptions: readonly {
                              readonly id: string
                              readonly label: string
                          }[]
                          labels: {
                              name: string
                              phone: string
                              service: string
                              date: string
                              time: string
                              resource: string
                              party: string
                              note: string
                              notePlaceholder: string
                              force: string
                              save: string
                              cancel: string
                              close: string
                          }
                      }
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
                | {
                      readonly cancel: {
                          title: string
                          confirmLabel: string
                          keepLabel: string
                      }
                      readonly placement: {
                          canForce: boolean
                          isPending: boolean
                          refusal?: string
                          mode: "add" | "move"
                          title: string
                          fields: PlacementFields
                          serviceOptions: {
                              id: string
                              label: string
                          }[]
                          resourceOptions: readonly {
                              readonly id: string
                              readonly label: string
                          }[]
                          labels: {
                              name: string
                              phone: string
                              service: string
                              date: string
                              time: string
                              resource: string
                              party: string
                              note: string
                              notePlaceholder: string
                              force: string
                              save: string
                              cancel: string
                              close: string
                          }
                      }
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
            >
            readonly placeholder:
                | {
                      readonly cancel?: never
                      readonly placement?: never
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
                | {
                      readonly cancel: {
                          title: string
                          confirmLabel: string
                          keepLabel: string
                      }
                      readonly placement?: never
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
                | {
                      readonly cancel?: never
                      readonly placement: {
                          canForce: boolean
                          isPending: boolean
                          refusal?: string
                          mode: "add" | "move"
                          title: string
                          fields: PlacementFields
                          serviceOptions: {
                              id: string
                              label: string
                          }[]
                          resourceOptions: readonly {
                              readonly id: string
                              readonly label: string
                          }[]
                          labels: {
                              name: string
                              phone: string
                              service: string
                              date: string
                              time: string
                              resource: string
                              party: string
                              note: string
                              notePlaceholder: string
                              force: string
                              save: string
                              cancel: string
                              close: string
                          }
                      }
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
                | {
                      readonly cancel: {
                          title: string
                          confirmLabel: string
                          keepLabel: string
                      }
                      readonly placement: {
                          canForce: boolean
                          isPending: boolean
                          refusal?: string
                          mode: "add" | "move"
                          title: string
                          fields: PlacementFields
                          serviceOptions: {
                              id: string
                              label: string
                          }[]
                          resourceOptions: readonly {
                              readonly id: string
                              readonly label: string
                          }[]
                          labels: {
                              name: string
                              phone: string
                              service: string
                              date: string
                              time: string
                              resource: string
                              party: string
                              note: string
                              notePlaceholder: string
                              force: string
                              save: string
                              cancel: string
                              close: string
                          }
                      }
                      readonly detail?:
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next?: never
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                          | {
                                isPending: boolean
                                actions: (
                                    | {
                                          id: BookingAction
                                          label: string
                                          intent: "neutral" | "destructive"
                                      }
                                    | {
                                          id: string
                                          label: string
                                          intent: "neutral"
                                      }
                                )[]
                                next: {
                                    id: BookingAction
                                    label: string
                                }
                                customerLabel: string
                                customerHref?: string
                                title: string
                                description: string
                                closeLabel: string
                                statusLabel: string
                                statusTone: BadgeTone
                                items: readonly BookingDetailFact[]
                            }
                      readonly days: {
                          id: string
                          label: string
                          rows: {
                              id: string
                              time: string
                              status: {
                                  text: string
                                  tone: BadgeTone
                              }
                              flags: (
                                  | {
                                        text: string
                                        tone: "neutral"
                                    }
                                  | {
                                        text: string
                                        tone: "warning"
                                    }
                              )[]
                              who: string
                              where: string
                              actions: {
                                  id: "done" | "confirm" | "check-in" | "no-show"
                                  label: string
                                  intent: "neutral" | "alternative"
                              }[]
                          }[]
                      }[]
                      readonly empty: {
                          readonly title: string
                          readonly body: string
                      }
                      readonly isPending: boolean
                      readonly notice?: {
                          tone: "negative" | "affirmative"
                          text: string
                          dismissLabel: string
                      }
                      readonly nav?: {
                          prevLabel: string
                          nextLabel: string
                          thisWeekLabel: string
                          dateLabel: string
                          date: string
                          showCancelledLabel: string
                          showCancelled: boolean
                          rangeText: string
                      }
                      readonly label: string
                      readonly legend: {
                          text: string
                          tone: BadgeTone
                      }[]
                      readonly add: {
                          readonly label: string
                          readonly isDisabled: boolean
                      }
                  }
            readonly labels: SlotLabels
        }
        readonly panel: {
            readonly slot: DataSlot<{
                readonly waitlist: {
                    readonly label: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly removeLabel: string
                    readonly rows: {
                        id: string
                        title: string
                        detail: string
                    }[]
                    readonly isPending: boolean
                }
                readonly stats: {
                    readonly rangeText: string
                    readonly label: string
                    readonly stats: readonly [
                        {
                            readonly id: "total"
                            readonly term: string
                            readonly value: string
                        },
                        {
                            readonly id: "done"
                            readonly term: string
                            readonly value: string
                        },
                        {
                            readonly id: "no_show"
                            readonly term: string
                            readonly value: string
                            readonly unit: `(${number}%)`
                        },
                        {
                            readonly id: "revenue"
                            readonly term: string
                            readonly value: string
                        },
                    ]
                    readonly utilisationLabel: string
                    readonly utilisationEmpty: string
                    readonly resources: {
                        id: string
                        name: string
                        pct: number
                        valueLabel: string
                        hoursText: string
                    }[]
                }
                readonly setup: {
                    readonly services: {
                        readonly isPending: boolean
                        readonly removing?: {
                            title: string
                            description: string
                            confirmLabel: string
                            cancelLabel: string
                        }
                        readonly form?: {
                            heading: string
                            fields: ServiceFields
                            nameLabel: string
                            durationLabel: string
                            bufferLabel: string
                            priceLabel: string
                            pricePlaceholder: string
                            kindLabel: string
                            kindPlaceholder: string
                            followupLabel: string
                            followupPlaceholder: string
                            descriptionLabel: string
                            activeLabel: string
                            saveLabel: string
                            cancelLabel: string
                        }
                        readonly title: string
                        readonly hint: string
                        readonly list: {
                            readonly label: string
                            readonly emptyText: string
                            readonly editLabel: string
                            readonly removeLabel: string
                            readonly rows: {
                                id: string
                                title: string
                                detail: string
                            }[]
                        }
                        readonly addLabel: string
                    }
                    readonly resources: {
                        readonly isPending: boolean
                        readonly notice?: {
                            tone: "negative" | "affirmative"
                            text: string
                        }
                        readonly removing?: {
                            title: string
                            description: string
                            confirmLabel: string
                            cancelLabel: string
                        }
                        readonly form?: {
                            heading: string
                            fields: ResourceFields
                            nameLabel: string
                            kindLabel: string
                            capacityLabel: string
                            activeLabel: string
                            staffLabel: string
                            staffOptions: {
                                id: string
                                label: string
                            }[]
                            hoursHeading: string
                            hoursHint: string
                            hours: {
                                day: 3 | 2 | 1 | 4 | 5 | 6 | 7
                                label: string
                                value: string
                            }[]
                            hoursPlaceholder: string
                            saveLabel: string
                            saveHoursLabel: string
                            cancelLabel: string
                            canSaveHours: boolean
                        }
                        readonly title: string
                        readonly hint: string
                        readonly list: {
                            readonly label: string
                            readonly emptyText: string
                            readonly editLabel: string
                            readonly removeLabel: string
                            readonly rows: {
                                id: string
                                title: string
                                detail: string
                            }[]
                        }
                        readonly addLabel: string
                    }
                    readonly exceptions: {
                        title: string
                        hint: string
                        rows: {
                            id: string
                            title: string
                            detail: string
                        }[]
                        removeLabel: string
                        fields: ExceptionFields
                        appliesLabel: string
                        applies: {
                            id: string
                            label: string
                        }[]
                        dateLabel: string
                        noteLabel: string
                        notePlaceholder: string
                        closedLabel: string
                        startLabel: string
                        endLabel: string
                        addLabel: string
                        isPending: boolean
                    }
                    readonly policy: {
                        readonly title: string
                        readonly hint: string
                        readonly rules: {
                            id:
                                | "cancelWindowHours"
                                | "depositPct"
                                | "lateCancelFeePct"
                                | "maxAdvanceDays"
                                | "minLeadMin"
                                | "noShowFeeVnd"
                                | "slotStepMin"
                            label: string
                            value: number
                        }[]
                        readonly addressLabel: string
                        readonly address: string
                        readonly autoConfirmLabel: string
                        readonly autoConfirm: boolean
                        readonly handoffLabel: string
                        readonly handoff: boolean
                        readonly saveLabel: string
                        readonly isPending: boolean
                    }
                    readonly publicPage: {
                        readonly saveLabel: string
                        readonly isPending: boolean
                        readonly link?: {
                            label: string
                            href: string
                            hint: string
                        }
                        readonly title: string
                        readonly hint: string
                        readonly enabledLabel: string
                        readonly enabled: boolean
                        readonly slugLabel: string
                        readonly slug: string
                        readonly slugPlaceholder: string
                        readonly noteLabel: string
                        readonly note: string
                        readonly notePlaceholder: string
                    }
                }
            }>
            readonly placeholder: {
                readonly waitlist: {
                    readonly label: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly removeLabel: string
                    readonly rows: {
                        id: string
                        title: string
                        detail: string
                    }[]
                    readonly isPending: boolean
                }
                readonly stats: {
                    readonly rangeText: string
                    readonly label: string
                    readonly stats: readonly [
                        {
                            readonly id: "total"
                            readonly term: string
                            readonly value: string
                        },
                        {
                            readonly id: "done"
                            readonly term: string
                            readonly value: string
                        },
                        {
                            readonly id: "no_show"
                            readonly term: string
                            readonly value: string
                            readonly unit: `(${number}%)`
                        },
                        {
                            readonly id: "revenue"
                            readonly term: string
                            readonly value: string
                        },
                    ]
                    readonly utilisationLabel: string
                    readonly utilisationEmpty: string
                    readonly resources: {
                        id: string
                        name: string
                        pct: number
                        valueLabel: string
                        hoursText: string
                    }[]
                }
                readonly setup: {
                    readonly services: {
                        readonly isPending: boolean
                        readonly removing?: {
                            title: string
                            description: string
                            confirmLabel: string
                            cancelLabel: string
                        }
                        readonly form?: {
                            heading: string
                            fields: ServiceFields
                            nameLabel: string
                            durationLabel: string
                            bufferLabel: string
                            priceLabel: string
                            pricePlaceholder: string
                            kindLabel: string
                            kindPlaceholder: string
                            followupLabel: string
                            followupPlaceholder: string
                            descriptionLabel: string
                            activeLabel: string
                            saveLabel: string
                            cancelLabel: string
                        }
                        readonly title: string
                        readonly hint: string
                        readonly list: {
                            readonly label: string
                            readonly emptyText: string
                            readonly editLabel: string
                            readonly removeLabel: string
                            readonly rows: {
                                id: string
                                title: string
                                detail: string
                            }[]
                        }
                        readonly addLabel: string
                    }
                    readonly resources: {
                        readonly isPending: boolean
                        readonly notice?: {
                            tone: "negative" | "affirmative"
                            text: string
                        }
                        readonly removing?: {
                            title: string
                            description: string
                            confirmLabel: string
                            cancelLabel: string
                        }
                        readonly form?: {
                            heading: string
                            fields: ResourceFields
                            nameLabel: string
                            kindLabel: string
                            capacityLabel: string
                            activeLabel: string
                            staffLabel: string
                            staffOptions: {
                                id: string
                                label: string
                            }[]
                            hoursHeading: string
                            hoursHint: string
                            hours: {
                                day: 3 | 2 | 1 | 4 | 5 | 6 | 7
                                label: string
                                value: string
                            }[]
                            hoursPlaceholder: string
                            saveLabel: string
                            saveHoursLabel: string
                            cancelLabel: string
                            canSaveHours: boolean
                        }
                        readonly title: string
                        readonly hint: string
                        readonly list: {
                            readonly label: string
                            readonly emptyText: string
                            readonly editLabel: string
                            readonly removeLabel: string
                            readonly rows: {
                                id: string
                                title: string
                                detail: string
                            }[]
                        }
                        readonly addLabel: string
                    }
                    readonly exceptions: {
                        title: string
                        hint: string
                        rows: {
                            id: string
                            title: string
                            detail: string
                        }[]
                        removeLabel: string
                        fields: ExceptionFields
                        appliesLabel: string
                        applies: {
                            id: string
                            label: string
                        }[]
                        dateLabel: string
                        noteLabel: string
                        notePlaceholder: string
                        closedLabel: string
                        startLabel: string
                        endLabel: string
                        addLabel: string
                        isPending: boolean
                    }
                    readonly policy: {
                        readonly title: string
                        readonly hint: string
                        readonly rules: {
                            id:
                                | "cancelWindowHours"
                                | "depositPct"
                                | "lateCancelFeePct"
                                | "maxAdvanceDays"
                                | "minLeadMin"
                                | "noShowFeeVnd"
                                | "slotStepMin"
                            label: string
                            value: number
                        }[]
                        readonly addressLabel: string
                        readonly address: string
                        readonly autoConfirmLabel: string
                        readonly autoConfirm: boolean
                        readonly handoffLabel: string
                        readonly handoff: boolean
                        readonly saveLabel: string
                        readonly isPending: boolean
                    }
                    readonly publicPage: {
                        readonly saveLabel: string
                        readonly isPending: boolean
                        readonly link?: {
                            label: string
                            href: string
                            hint: string
                        }
                        readonly title: string
                        readonly hint: string
                        readonly enabledLabel: string
                        readonly enabled: boolean
                        readonly slugLabel: string
                        readonly slug: string
                        readonly slugPlaceholder: string
                        readonly noteLabel: string
                        readonly note: string
                        readonly notePlaceholder: string
                    }
                }
            }
            readonly labels: SlotLabels
        }
        readonly why: {
            view: null
            labels: {
                pathLabel: string
                factsLabel: string
                sourcesLabel: string
                approverLabel: string
                timeLabel: string
                openOnMap: string
                missingTitle: string
                missingBody: string
            }
            closeLabel: string
            openLabel: string
            paneLabel: string
            listLabel: string
            workItemId: string | null
        }
        readonly regions: {
            waiting: {
                label: string
                slot: DataSlot<{
                    count: string | null
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    openLabel: string
                    more: string | null
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    count: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    openLabel: string
                    more: string | null
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            done: {
                label: string
                slot: DataSlot<{
                    count: string
                    logLabel: string
                    logHref: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    count: string
                    logLabel: string
                    logHref: string
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            connections: {
                label: string
                slot: DataSlot<{
                    manageLabel: string
                    manageHref: "/connections"
                    rows: {
                        id: string
                        name: string
                        description: string
                        statusLabel: string
                        statusTone: BadgeTone
                        accessLabel: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    rows: {
                        name: string
                        statusLabel: string
                        statusTone: "neutral"
                        accessLabel: string
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    manageLabel: string
                    manageHref: "/connections"
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            knowledge: {
                label: string
                slot: DataSlot<{
                    openLabel: string
                    openHref: string
                    footer: string
                    publicTitle: string
                    publicDescription: string
                    internalTitle: string
                    internalDescription: string
                    gaps: {
                        label: string
                        count: string | null
                        openLabel: string
                        openHref: string
                        rows: {
                            id: string
                            title: string
                            description: string
                            asked: string
                        }[]
                        emptyMessage: string
                        emptyDescription: string
                    } | null
                }>
                placeholder: {
                    openLabel: string
                    openHref: string
                    footer: string
                    publicTitle: string
                    publicDescription: string
                    internalTitle: string
                    internalDescription: string
                    gaps: {
                        label: string
                        count: string | null
                        openLabel: string
                        openHref: string
                        rows: {
                            id: string
                            title: string
                            description: string
                            asked: string
                        }[]
                        emptyMessage: string
                        emptyDescription: string
                    } | null
                }
                labels: SlotLabels
            }
        }
        readonly tabsLabel: string
        readonly selectedTab: "today" | "setup" | "calendar" | "waitlist" | "stats"
        readonly tabs: {
            id: "today" | "setup" | "calendar" | "waitlist" | "stats"
            label: string
        }[]
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly closeWhy: () => void
        readonly retryDashboard: () => void
        readonly retryPanel: () => Promise<
            | {
                  from: string
                  nowMs: number
                  timezone: string
                  to: string
                  today: string
                  bookings: Array<{
                      checkedIn: boolean
                      conflictNote: string
                      customer: string
                      date: string
                      depositStatus: string
                      depositVnd: number
                      endClock: string
                      endMin: number
                      endMs: number
                      feeVnd: number
                      holdsSlot: boolean
                      id: string
                      leadId: string | null
                      note: string
                      party: number
                      phone: string | null
                      priceVnd: number | null
                      reschedules: number
                      resourceId: string
                      service: string
                      serviceId: string
                      source: string
                      startClock: string
                      startMin: number
                      startMs: number
                      status: string
                  }>
                  exceptions: Array<{
                      closed: boolean
                      date: string
                      end: string | null
                      id: string
                      note: string
                      resourceId: string | null
                      start: string | null
                  }>
                  figures: {
                      bookingsToday: number
                      depositsPending: number
                      depositsPendingVnd: number
                      finished30d: number
                      noShowPct30d: number | null
                      utilisationPct: number | null
                  }
                  hours: Array<{
                      end: string
                      resourceId: string
                      start: string
                      weekday: number
                  }>
                  resources: Array<{
                      active: boolean
                      capacity: number
                      color: string
                      id: string
                      kind: string
                      name: string
                      sort: number
                      staffId: string | null
                  }>
                  services: Array<{
                      active: boolean
                      bufferMin: number
                      description: string
                      durationMin: number
                      followupDays: number | null
                      id: string
                      name: string
                      priceVnd: number | null
                      resourceKind: string | null
                  }>
                  settings: {
                      address: string
                      autoConfirm: boolean
                      cancelWindowHours: number
                      depositPct: number
                      handoffOrder: boolean
                      lateCancelFeePct: number
                      maxAdvanceDays: number
                      minLeadMin: number
                      noShowFeeVnd: number
                      publicEnabled: boolean
                      publicNote: string
                      publicSlug: string | null
                      reminderHours: Array<number>
                      slotStepMin: number
                      timezone: string
                  }
                  staff: Array<{
                      id: string
                      name: string
                  }>
                  stats: {
                      doneRevenueVnd: number
                      noShowPct: number
                      total: number
                      byResource: Array<{
                          bookedMin: number
                          name: string
                          openMin: number
                          pct: number
                          resourceId: string
                      }>
                      byStatus: Array<{
                          count: number
                          status: string
                      }>
                  }
                  waitlist: Array<{
                      customer: string
                      fromMs: number
                      id: string
                      party: number
                      phone: string | null
                      service: string
                      status: string
                      toMs: number
                  }>
              }
            | undefined
        >
        readonly retryRibbon: () => Promise<
            | {
                  from: string
                  nowMs: number
                  timezone: string
                  to: string
                  today: string
                  bookings: Array<{
                      checkedIn: boolean
                      conflictNote: string
                      customer: string
                      date: string
                      depositStatus: string
                      depositVnd: number
                      endClock: string
                      endMin: number
                      endMs: number
                      feeVnd: number
                      holdsSlot: boolean
                      id: string
                      leadId: string | null
                      note: string
                      party: number
                      phone: string | null
                      priceVnd: number | null
                      reschedules: number
                      resourceId: string
                      service: string
                      serviceId: string
                      source: string
                      startClock: string
                      startMin: number
                      startMs: number
                      status: string
                  }>
                  exceptions: Array<{
                      closed: boolean
                      date: string
                      end: string | null
                      id: string
                      note: string
                      resourceId: string | null
                      start: string | null
                  }>
                  figures: {
                      bookingsToday: number
                      depositsPending: number
                      depositsPendingVnd: number
                      finished30d: number
                      noShowPct30d: number | null
                      utilisationPct: number | null
                  }
                  hours: Array<{
                      end: string
                      resourceId: string
                      start: string
                      weekday: number
                  }>
                  resources: Array<{
                      active: boolean
                      capacity: number
                      color: string
                      id: string
                      kind: string
                      name: string
                      sort: number
                      staffId: string | null
                  }>
                  services: Array<{
                      active: boolean
                      bufferMin: number
                      description: string
                      durationMin: number
                      followupDays: number | null
                      id: string
                      name: string
                      priceVnd: number | null
                      resourceKind: string | null
                  }>
                  settings: {
                      address: string
                      autoConfirm: boolean
                      cancelWindowHours: number
                      depositPct: number
                      handoffOrder: boolean
                      lateCancelFeePct: number
                      maxAdvanceDays: number
                      minLeadMin: number
                      noShowFeeVnd: number
                      publicEnabled: boolean
                      publicNote: string
                      publicSlug: string | null
                      reminderHours: Array<number>
                      slotStepMin: number
                      timezone: string
                  }
                  staff: Array<{
                      id: string
                      name: string
                  }>
                  stats: {
                      doneRevenueVnd: number
                      noShowPct: number
                      total: number
                      byResource: Array<{
                          bookedMin: number
                          name: string
                          openMin: number
                          pct: number
                          resourceId: string
                      }>
                      byStatus: Array<{
                          count: number
                          status: string
                      }>
                  }
                  waitlist: Array<{
                      customer: string
                      fromMs: number
                      id: string
                      party: number
                      phone: string | null
                      service: string
                      status: string
                      toMs: number
                  }>
              }
            | undefined
        >
        readonly retryDesk: () => Promise<
            | {
                  from: string
                  nowMs: number
                  timezone: string
                  to: string
                  today: string
                  bookings: Array<{
                      checkedIn: boolean
                      conflictNote: string
                      customer: string
                      date: string
                      depositStatus: string
                      depositVnd: number
                      endClock: string
                      endMin: number
                      endMs: number
                      feeVnd: number
                      holdsSlot: boolean
                      id: string
                      leadId: string | null
                      note: string
                      party: number
                      phone: string | null
                      priceVnd: number | null
                      reschedules: number
                      resourceId: string
                      service: string
                      serviceId: string
                      source: string
                      startClock: string
                      startMin: number
                      startMs: number
                      status: string
                  }>
                  exceptions: Array<{
                      closed: boolean
                      date: string
                      end: string | null
                      id: string
                      note: string
                      resourceId: string | null
                      start: string | null
                  }>
                  figures: {
                      bookingsToday: number
                      depositsPending: number
                      depositsPendingVnd: number
                      finished30d: number
                      noShowPct30d: number | null
                      utilisationPct: number | null
                  }
                  hours: Array<{
                      end: string
                      resourceId: string
                      start: string
                      weekday: number
                  }>
                  resources: Array<{
                      active: boolean
                      capacity: number
                      color: string
                      id: string
                      kind: string
                      name: string
                      sort: number
                      staffId: string | null
                  }>
                  services: Array<{
                      active: boolean
                      bufferMin: number
                      description: string
                      durationMin: number
                      followupDays: number | null
                      id: string
                      name: string
                      priceVnd: number | null
                      resourceKind: string | null
                  }>
                  settings: {
                      address: string
                      autoConfirm: boolean
                      cancelWindowHours: number
                      depositPct: number
                      handoffOrder: boolean
                      lateCancelFeePct: number
                      maxAdvanceDays: number
                      minLeadMin: number
                      noShowFeeVnd: number
                      publicEnabled: boolean
                      publicNote: string
                      publicSlug: string | null
                      reminderHours: Array<number>
                      slotStepMin: number
                      timezone: string
                  }
                  staff: Array<{
                      id: string
                      name: string
                  }>
                  stats: {
                      doneRevenueVnd: number
                      noShowPct: number
                      total: number
                      byResource: Array<{
                          bookedMin: number
                          name: string
                          openMin: number
                          pct: number
                          resourceId: string
                      }>
                      byStatus: Array<{
                          count: number
                          status: string
                      }>
                  }
                  waitlist: Array<{
                      customer: string
                      fromMs: number
                      id: string
                      party: number
                      phone: string | null
                      service: string
                      status: string
                      toMs: number
                  }>
              }
            | undefined
        >
        readonly desk: {
            readonly onAdd: () => unknown
            readonly onPlacementChange: (patch: Partial<PlacementFields>) => void
            readonly onPlacementSubmit: () => void
            readonly onPlacementClose: () => void
            readonly onPrev: () => void
            readonly onNext: () => void
            readonly onThisWeek: () => void
            readonly onPickDate: (date: string) => void
            readonly onToggleCancelled: (value: boolean) => void
            readonly onDismissNotice: () => void
            readonly onOpen: (id: string) => void
            readonly onAct: (id: string, action: string) => void
            readonly onConfirmCancel: () => void
            readonly onKeepBooking: () => void
            readonly onDetailAction: (action: string) => void
            readonly onCloseDetail: () => void
        }
        readonly setup: {
            readonly services: {
                readonly onAdd: () => void
                readonly onEdit: (id: string) => void
                readonly onAsk: (id: string) => void
                readonly onChange: (patch: Partial<ServiceFields>) => false | void
                readonly onSave: () => void
                readonly onCancelForm: () => void
                readonly onConfirmRemove: () => void
                readonly onCancelRemove: () => void
            }
            readonly resources: {
                readonly onAdd: () => void
                readonly onEdit: (id: string) => void
                readonly onAsk: (id: string) => void
                readonly onChange: (patch: Partial<ResourceFields>) => false | void
                readonly onChangeHours: (day: number, value: string) => false | void
                readonly onSave: () => void
                readonly onSaveHours: () => void
                readonly onCancelForm: () => void
                readonly onConfirmRemove: () => void
                readonly onCancelRemove: () => void
            }
            readonly exceptions: {
                readonly onChange: (patch: Partial<ExceptionFields>) => void
                readonly onAdd: () => void
                readonly onRemove: (id: string) => void
            }
            readonly policy: {
                readonly onChangeRule: (id: string, value: number) => void
                readonly onChangeAddress: (value: string) => void
                readonly onToggleAutoConfirm: (value: boolean) => void
                readonly onToggleHandoff: (value: boolean) => void
                readonly onSave: () => void
            }
            readonly publicPage: {
                readonly onToggleEnabled: (value: boolean) => void
                readonly onChangeSlug: (value: string) => void
                readonly onChangeNote: (value: string) => void
                readonly onSave: () => void
            }
        }
        readonly waitlist: {
            readonly onRemove: (id: string) => void
        }
    }
}

/** Owns the booking workbench's real read scopes and the exact lifetimes of its former conditional tab panels. */
export const useBookingWorkbenchView = (input: BookingWorkbenchViewInput): BookingWorkbenchView => {
    const t = useTranslations("workbenchBooking")
    const labels = useSlotLabels()
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const scope = JSON.stringify([workspaceId ?? null, input.installationId])
    const {
        tabs,
        dashboard: frame,
        isNormal: overview,
        frameOf,
    } = useAgentWorkbenchShell({
        module: "booking",
        installationId: input.installationId,
        ids: BOOKING_TABS,
        initialTab: input.initialTab,
    })
    const board = useBookingBoard(overview)
    const deskActive = overview && (tabs.selected === "calendar" || tabs.selected === "today")
    const setupActive = overview && tabs.selected === "setup"
    const ribbon = useBookingFiguresView(board)
    const desk = useBookingDeskView({ mode: tabs.selected === "today" ? "today" : "week", isActive: deskActive, scope })
    const waitlist = useBookingWaitlistView(overview && tabs.selected === "waitlist", scope, board)
    const stats = useBookingStatsView(board)
    const setup = useBookingSetupView(setupActive, scope, board)
    const panel = { waitlist: waitlist.props, stats: stats.props, setup: setup.props } as const
    return {
        shape: overview ? tabs.selected : ("explanation" as const),
        props: {
            ...frameOf(input.tabs),
            ribbon: ribbon.props,
            desk: desk.props,
            panel: {
                slot: mapSlot(board.boardSlot, () => panel),
                placeholder: panel,
                labels: labels(t("loadFailedTitle")),
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retryPanel: board.reload,
            retryRibbon: ribbon.on.retry,
            retryDesk: desk.on.retry,
            desk: {
                onAdd: desk.on.add,
                onPlacementChange: desk.on.placementChange,
                onPlacementSubmit: desk.on.placementSubmit,
                onPlacementClose: desk.on.placementClose,
                onPrev: desk.on.prev,
                onNext: desk.on.next,
                onThisWeek: desk.on.thisWeek,
                onPickDate: desk.on.pickDate,
                onToggleCancelled: desk.on.toggleCancelled,
                onDismissNotice: desk.on.dismissNotice,
                onOpen: desk.on.open,
                onAct: desk.on.act,
                onConfirmCancel: desk.on.confirmCancel,
                onKeepBooking: desk.on.keepBooking,
                onDetailAction: desk.on.detailAction,
                onCloseDetail: desk.on.closeDetail,
            },
            setup: setup.on,
            waitlist: { onRemove: waitlist.on.remove },
        },
    } as const
}
