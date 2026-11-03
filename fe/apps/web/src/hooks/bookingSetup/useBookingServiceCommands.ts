"use client"

import { useMutateRemoveBookingServiceSwr, useMutateSaveBookingServiceSwr } from "@/hooks/swr"
import { setupCommandOf } from "./bookingSetup.shared"
import { useBookingSetupSave } from "./useBookingSetupSave"

/** The view `useBookingServiceCommands` returns. */
export interface BookingServiceCommandsView {
    saveService: (
        arg: {
            followupDays?: number | null | undefined
            id?: string | number | null | undefined
            priceVnd?: number | null | undefined
        } & {
            active: boolean
            bufferMin: number
            description: string
            durationMin: number
            name: string
            resourceKind: string
        },
    ) => Promise<
        | {
              id: string
          }
        | undefined
    >
    removeService: (
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
 * The writes of the services the shop sells by appointment: save one, remove one. Each is toasted, refreshes the board after a
 * success, and answers the result, or undefined when it failed.
 */
export const useBookingServiceCommands = (): BookingServiceCommandsView => {
    const command = setupCommandOf(useBookingSetupSave())
    return {
        saveService: command(useMutateSaveBookingServiceSwr()),
        removeService: command(useMutateRemoveBookingServiceSwr()),
    }
}
