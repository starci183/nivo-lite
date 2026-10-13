import type { Mutation, MutationSaveBookingHoursArgs } from "../../__generated__/schema"

/** The input of the `saveBookingHours` mutation. */
export type MutateSaveBookingHoursRequest = MutationSaveBookingHoursArgs["input"]

/** The response of the `saveBookingHours` mutation. */
export type MutateSaveBookingHoursResponse = Pick<Mutation, "saveBookingHours">
