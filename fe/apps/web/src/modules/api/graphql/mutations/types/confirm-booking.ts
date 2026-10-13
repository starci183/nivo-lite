import type { Mutation, MutationConfirmBookingArgs } from "../../__generated__/schema"

/** The input of the `confirmBooking` mutation. */
export type MutateConfirmBookingRequest = MutationConfirmBookingArgs["input"]

/** The response of the `confirmBooking` mutation. */
export type MutateConfirmBookingResponse = Pick<Mutation, "confirmBooking">
