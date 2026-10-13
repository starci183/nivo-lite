import type { Mutation, MutationCancelBookingArgs } from "../../__generated__/schema"

/** The input of the `cancelBooking` mutation. */
export type MutateCancelBookingRequest = MutationCancelBookingArgs["input"]

/** The response of the `cancelBooking` mutation. */
export type MutateCancelBookingResponse = Pick<Mutation, "cancelBooking">
