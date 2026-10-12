import { Command } from "@nestjs/cqrs"
import type { RequestSendOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestSendRequest } from "./request-send.contracts"

/** Asks to put a purchase order before the owner to send. */
export class RequestSendCommand extends Command<RequestSendOutput> {
    constructor(readonly params: ExecuteParams<RequestSendRequest>) {
        super()
    }
}
