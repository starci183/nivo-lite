import type { CheckFirstEventResult } from "../../application/check-first-event.contracts"
import type { FirstEventResponse } from "./dto/first-event.response"

/** Maps the first-event state to the HTTP response. */
export const toFirstEventResponse = (result: CheckFirstEventResult): FirstEventResponse => ({
    status: result.status,
    firstEvent: result.firstEvent,
})
