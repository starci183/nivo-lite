import type { AddBookingRequest, AddBookingResult } from "../../application/add-booking.contracts"
import type { AddBookingParamsRequest, AddBookingBodyRequest } from "./dto/add-booking.request"
import type { AddBookingResponse } from "./dto/add-booking.response"

/** Maps the HTTP input of add-booking to the command request. */
export const toAddBookingRequest = (
    params: AddBookingParamsRequest,
    body: AddBookingBodyRequest,
): AddBookingRequest => ({
    workspaceId: params.workspaceId,
    serviceId: body.serviceId,
    resourceId: body.resourceId,
    date: body.date,
    time: body.time,
    party: body.party,
    name: body.name,
    phone: body.phone,
    note: body.note,
    force: body.force,
})

/** Maps the add-booking result to the HTTP answer. */
export const toAddBookingResponse = (result: AddBookingResult): AddBookingResponse => result
