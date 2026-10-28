import { Command } from "@nestjs/cqrs"
import type { ZaloTestSendResult } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SendZaloTestRequest } from "./send-zalo-test.contracts"

/** Asks for a real test text to a Zalo follower. */
export class SendZaloTestCommand extends Command<ZaloTestSendResult> {
    constructor(readonly params: ExecuteParams<SendZaloTestRequest>) {
        super()
    }
}
