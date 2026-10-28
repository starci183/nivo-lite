"use client"

import {
    useMutateRemoveBookingResourceSwr,
    useMutateSaveBookingHoursSwr,
    useMutateSaveBookingResourceSwr,
} from "@/hooks/swr"
import { setupCommandOf } from "./bookingSetup.shared"
import { useBookingSetupSave } from "./useBookingSetupSave"

/**
 * The writes of the people and rooms of the shop: save one, save its weekly hours, remove one. Each is toasted, refreshes the board
 * after a success, and answers the result, or undefined when it failed.
 */
export const useBookingResourceCommands = () => {
    const command = setupCommandOf(useBookingSetupSave())
    return {
        saveResource: command(useMutateSaveBookingResourceSwr()),
        saveHours: command(useMutateSaveBookingHoursSwr()),
        removeResource: command(useMutateRemoveBookingResourceSwr()),
    }
}
