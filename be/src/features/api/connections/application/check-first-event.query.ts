import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckFirstEventRequest, CheckFirstEventResult } from "./check-first-event.contracts"

/** Answers whether the first event has reached a connection (manager). */
export class CheckFirstEventQuery extends Query<CheckFirstEventResult> {
    constructor(readonly params: ExecuteParams<CheckFirstEventRequest>) {
        super()
    }
}
