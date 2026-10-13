import type { Mutation, MutationMoveBookingArgs } from "../../__generated__/schema"

/** The input of the `moveBooking` mutation. */
export type MutateMoveBookingRequest = MutationMoveBookingArgs["input"]

/** The response of the `moveBooking` mutation. */
export type MutateMoveBookingResponse = Pick<Mutation, "moveBooking">
