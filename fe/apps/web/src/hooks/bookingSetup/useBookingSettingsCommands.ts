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

/**
 * The writes of how the shop takes bookings: its days off, its policy, its public page and its waiting list. Each is toasted,
 * refreshes the board after a success, and answers the result, or undefined when it failed.
 */
export const useBookingSettingsCommands = () => {
    const command = setupCommandOf(useBookingSetupSave())
    return {
        saveException: command(useMutateSaveBookingExceptionSwr()),
        removeException: command(useMutateRemoveBookingExceptionSwr()),
        savePolicy: command(useMutateSaveBookingPolicySwr()),
        savePublicPage: command(useMutateSaveBookingPublicPageSwr()),
        removeWaitlistEntry: command(useMutateRemoveBookingWaitlistEntrySwr()),
    }
}
