import { Command } from "@nestjs/cqrs"
import type { RequestSendOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestInventorySendRequest } from "./request-inventory-send.contracts"

/** Asks for put a purchase order before the owner to send, or to remind the supplier. */
export class RequestInventorySendCommand extends Command<RequestSendOutput> {
    constructor(readonly params: ExecuteParams<RequestInventorySendRequest>) {
        super()
    }
}
