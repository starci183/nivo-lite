import type { Mutation, MutationSaveBookingServiceArgs } from "../../__generated__/schema"

/** The input of the `saveBookingService` mutation. */
export type MutateSaveBookingServiceRequest = MutationSaveBookingServiceArgs["input"]

/** The response of the `saveBookingService` mutation. */
export type MutateSaveBookingServiceResponse = Pick<Mutation, "saveBookingService">
