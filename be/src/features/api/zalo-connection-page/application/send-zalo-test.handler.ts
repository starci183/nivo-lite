import { CommandHandler } from "@nestjs/cqrs"
import { ZaloPageService } from "@modules/domain/channels"
import type { ZaloTestSendResult } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SendZaloTestCommand } from "./send-zalo-test.command"

@CommandHandler(SendZaloTestCommand)
/** Answers a real test text to a Zalo follower through the ZaloPageService. */
export class SendZaloTestHandler extends ICQRSHandler<SendZaloTestCommand, ZaloTestSendResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ZaloPageService,
    ) {
        super(logger)
    }

    protected override process(query: SendZaloTestCommand): Promise<ZaloTestSendResult> {
        return this.page.sendTest(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
            query.params.request.recipientId,
            query.params.request.text,
        )
    }
}
