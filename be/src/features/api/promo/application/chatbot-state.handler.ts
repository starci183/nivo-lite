import { QueryHandler } from "@nestjs/cqrs"
import { PromoService } from "@modules/domain/promo"
import type { PromoChatbotState } from "@modules/domain/promo"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PromoChatbotStateQuery } from "./chatbot-state.query"

@QueryHandler(PromoChatbotStateQuery)
/** Reads promoChatbotState through the workspace-authorized promo service. */
export class PromoChatbotStateHandler extends ICQRSHandler<PromoChatbotStateQuery, PromoChatbotState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promo: PromoService,
    ) {
        super(logger)
    }

    protected override process(query: PromoChatbotStateQuery): Promise<PromoChatbotState> {
        return this.promo.chatbot(query.params.principal.id, query.params.request.workspaceId)
    }
}
