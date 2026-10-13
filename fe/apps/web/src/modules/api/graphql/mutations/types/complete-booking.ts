import type { Mutation, MutationCompleteBookingArgs } from "../../__generated__/schema"

/** The input of the `completeBooking` mutation. */
export type MutateCompleteBookingRequest = MutationCompleteBookingArgs["input"]

/** The response of the `completeBooking` mutation. */
export type MutateCompleteBookingResponse = Pick<Mutation, "completeBooking">
