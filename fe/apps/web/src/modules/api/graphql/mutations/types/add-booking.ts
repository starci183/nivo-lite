import type { Mutation, MutationAddBookingArgs } from "../../__generated__/schema"

/** The input of the `addBooking` mutation. */
export type MutateAddBookingRequest = MutationAddBookingArgs["input"]

/** The response of the `addBooking` mutation. */
export type MutateAddBookingResponse = Pick<Mutation, "addBooking">
