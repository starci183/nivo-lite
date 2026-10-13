import type { Mutation, MutationCheckInBookingArgs } from "../../__generated__/schema"

/** The input of the `checkInBooking` mutation. */
export type MutateCheckInBookingRequest = MutationCheckInBookingArgs["input"]

/** The response of the `checkInBooking` mutation. */
export type MutateCheckInBookingResponse = Pick<Mutation, "checkInBooking">
