"use client"

import { useMutateRemoveBookingServiceSwr, useMutateSaveBookingServiceSwr } from "@/hooks/swr"
import { setupCommandOf } from "./bookingSetup.shared"
import { useBookingSetupSave } from "./useBookingSetupSave"

/**
 * The writes of the services the shop sells by appointment: save one, remove one. Each is toasted, refreshes the board after a
 * success, and answers the result, or undefined when it failed.
 */
export const useBookingServiceCommands = () => {
    const command = setupCommandOf(useBookingSetupSave())
    return {
        saveService: command(useMutateSaveBookingServiceSwr()),
        removeService: command(useMutateRemoveBookingServiceSwr()),
    }
}
