"use client"

import {
    useMutateRemoveBookingResourceSwr,
    useMutateSaveBookingHoursSwr,
    useMutateSaveBookingResourceSwr,
} from "@/hooks/swr"
import { setupCommandOf } from "./bookingSetup.shared"
import { useBookingSetupSave } from "./useBookingSetupSave"

/** The view `useBookingResourceCommands` returns. */
export interface BookingResourceCommandsView {
    saveResource: (
        arg: {
            id?: string | number | null | undefined
            staffId?: string | number | null | undefined
        } & {
            active: boolean
            capacity: number
            kind: string
            name: string
        },
    ) => Promise<
        | {
              id: string
          }
        | undefined
    >
    saveHours: (arg: {
        resourceId: string | number
        rows: {
            end: string
            start: string
            weekday: number
        }[]
    }) => Promise<
        | {
              id: string
          }
        | undefined
    >
    removeResource: (arg: { id: string | number }) => Promise<
        | {
              id: string
          }
        | undefined
    >
}

/**
 * The writes of the people and rooms of the shop: save one, save its weekly hours, remove one. Each is toasted, refreshes the board
 * after a success, and answers the result, or undefined when it failed.
 */
export const useBookingResourceCommands = (): BookingResourceCommandsView => {
    const command = setupCommandOf(useBookingSetupSave())
    return {
        saveResource: command(useMutateSaveBookingResourceSwr()),
        saveHours: command(useMutateSaveBookingHoursSwr()),
        removeResource: command(useMutateRemoveBookingResourceSwr()),
    }
}
