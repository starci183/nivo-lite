import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AcceptMetaDeliveryRequest, AcceptMetaDeliveryResult } from "./accept-meta-delivery.contracts"

/** Records one signed Meta webhook delivery: the signature is the proof, there is no caller. */
export class AcceptMetaDeliveryCommand extends Command<AcceptMetaDeliveryResult> {
    constructor(readonly params: PublicExecuteParams<AcceptMetaDeliveryRequest>) {
        super()
    }
}
