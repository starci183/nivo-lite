"use client"

import {
    useMutateRemoveBookingExceptionSwr,
    useMutateRemoveBookingWaitlistEntrySwr,
    useMutateSaveBookingExceptionSwr,
    useMutateSaveBookingPolicySwr,
    useMutateSaveBookingPublicPageSwr,
} from "@/hooks/swr"
import { setupCommandOf } from "./bookingSetup.shared"
import { useBookingSetupSave } from "./useBookingSetupSave"

/** The view `useBookingSettingsCommands` returns. */
export interface BookingSettingsCommandsView {
    saveException: (
        arg: {
            resourceId?: string | number | null | undefined
        } & {
            closed: boolean
            date: string
            end: string
            note: string
            start: string
        },
    ) => Promise<
        | {
              id: string
          }
        | undefined
    >
    removeException: (
        arg: {} & {
            id: string | number
        },
    ) => Promise<
        | {
              id: string
          }
        | undefined
    >
    savePolicy: (
        arg: {} & {
            address: string
            autoConfirm: boolean
            cancelWindowHours: number
            depositPct: number
            handoffOrder: boolean
            lateCancelFeePct: number
            maxAdvanceDays: number
            minLeadMin: number
            noShowFeeVnd: number
            slotStepMin: number
            timezone: string
        },
    ) => Promise<
        | {
              workspaceId: string
          }
        | undefined
    >
    savePublicPage: (
        arg: {} & {
            enabled: boolean
            note: string
            slug: string
        },
    ) => Promise<
        | {
              workspaceId: string
          }
        | undefined
    >
    removeWaitlistEntry: (
        arg: {} & {
            id: string | number
        },
    ) => Promise<
        | {
              id: string
          }
        | undefined
    >
}

/**
 * The writes of how the shop takes bookings: its days off, its policy, its public page and its waiting list. Each is toasted,
 * refreshes the board after a success, and answers the result, or undefined when it failed.
 */
export const useBookingSettingsCommands = (): BookingSettingsCommandsView => {
    const command = setupCommandOf(useBookingSetupSave())
    return {
        saveException: command(useMutateSaveBookingExceptionSwr()),
        removeException: command(useMutateRemoveBookingExceptionSwr()),
        savePolicy: command(useMutateSaveBookingPolicySwr()),
        savePublicPage: command(useMutateSaveBookingPublicPageSwr()),
        removeWaitlistEntry: command(useMutateRemoveBookingWaitlistEntrySwr()),
    }
}
