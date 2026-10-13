import { Query } from "@nestjs/cqrs"
import type { PromoChatbotState } from "@modules/domain/promo"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PromoChatbotStateRequest } from "./chatbot-state.contracts"

/** Requests promoChatbotState for a workspace member. */
export class PromoChatbotStateQuery extends Query<PromoChatbotState> {
    constructor(readonly params: ExecuteParams<PromoChatbotStateRequest>) {
        super()
    }
}
