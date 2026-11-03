"use client"

import { useBookingDeskState } from "./useBookingDeskState"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"

import { useFormatter, useTranslations } from "next-intl"
import {
    BOOKING_STATUS_TONE,
    MOVE_ACTION,
    dayGroups,
    detailOf,
    bookingRowOf,
    type PlacementFields,
} from "@/hooks/bookingDesk"
import { AUTO_RESOURCE } from "@/modules/booking-desk"

import {
    buildBookingCancel,
    buildBookingLegend,
    buildBookingDeskEvents,
    bookingPlacementView,
} from "@/hooks/bookingDeskView"
import type { DataSlot, BookingAction, BookingDetailFact, SlotLabels } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

/** The desk remains one lifetime across Calendar and Today; leaving both or changing real identity retires its edits. */
interface BookingDeskViewInput {
    readonly mode: Parameters<typeof useBookingDeskState>[0]["mode"]
    readonly isActive: boolean
    readonly scope: string
}
/** The view `useBookingDeskView` returns. */
export interface BookingDeskView {
    readonly props: {
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
    readonly on: {
        readonly retry: () => Promise<
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
        readonly add: () => unknown
        readonly placementChange: (patch: Partial<PlacementFields>) => void
        readonly placementSubmit: () => void
        readonly placementClose: () => void
        readonly prev: () => void
        readonly next: () => void
        readonly thisWeek: () => void
        readonly pickDate: (date: string) => void
        readonly toggleCancelled: (value: boolean) => void
        readonly dismissNotice: () => void
        readonly open: (id: string) => void
        readonly act: (id: string, action: string) => void
        readonly confirmCancel: () => void
        readonly keepBooking: () => void
        readonly detailAction: (action: string) => void
        readonly closeDetail: () => void
    }
}

/** Draws the connected view from its current state. */
export const useBookingDeskView = (input: BookingDeskViewInput): BookingDeskView => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const connected = useBookingDeskState({ ...input, t, format })
    return {
        props: {
            slot: mapSlot(slotOfSwr(connected.range.read), () => bookingDeskProps(connected)),
            placeholder: bookingDeskProps(connected),
            labels: slotLabels(t("loadFailedTitle")),
        },
        on: {
            ...buildBookingDeskEvents(connected, MOVE_ACTION),
            retry: () => connected.range.reload(),
        },
    } as const
}

/** Builds the props supplied to BookingDeskBase. */
const bookingDeskProps = (connected: NonNullable<ReturnType<typeof useBookingDeskState>>) => {
    return {
        label: connected.t("calendarLabel"),
        legend: buildBookingLegend(BOOKING_STATUS_TONE, connected.t),
        add: { label: connected.t("addBooking"), isDisabled: connected.place.isBusy },
        ...(connected.isToday ? {} : { nav: connected.nav }),
        ...(connected.desk.notice === null
            ? {}
            : {
                  notice: {
                      tone: connected.desk.notice.tone,
                      text: connected.t(connected.desk.notice.code),
                      dismissLabel: connected.t("dismiss"),
                  },
              }),
        days: dayGroups(connected.visible).map((day) => ({
            id: day.id,
            label: connected.dayText(day.id),
            rows: day.rows.map((booking) => bookingRowOf(booking, connected.words, connected.isToday)),
        })),
        empty: {
            title: connected.t(connected.isToday ? "todayEmptyTitle" : "emptyWeekTitle"),
            body: connected.t(connected.isToday ? "todayEmptyBody" : "emptyWeekBody"),
        },
        isPending: connected.desk.isBusy || connected.place.isBusy || connected.range.isLoading,
        ...(connected.open === undefined
            ? {}
            : { detail: { ...detailOf(connected.open, connected.words), isPending: connected.desk.isBusy } }),
        ...bookingPlacementView(connected, AUTO_RESOURCE),
        ...buildBookingCancel(connected.cancelling, connected.t),
    } as const
}
