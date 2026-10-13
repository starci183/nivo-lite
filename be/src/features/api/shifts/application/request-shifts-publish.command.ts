import { Command } from "@nestjs/cqrs"
import type { RequestOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestShiftsPublishRequest } from "./request-shifts-publish.contracts"

/** Asks for put a draft schedule before the owner to publish. */
export class RequestShiftsPublishCommand extends Command<RequestOutput> {
    constructor(readonly params: ExecuteParams<RequestShiftsPublishRequest>) {
        super()
    }
}
