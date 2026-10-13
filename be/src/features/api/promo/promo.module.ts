import { Module } from "@nestjs/common"
import { PromoStateHandler } from "./application/promo-state.handler"
import { PromoChatbotStateHandler } from "./application/chatbot-state.handler"
import { FoundingMemberHandler } from "./application/founding-member.handler"
import { LeadWaitHandler } from "./application/lead-wait.handler"

@Module({ providers: [PromoStateHandler, PromoChatbotStateHandler, FoundingMemberHandler, LeadWaitHandler] })
/** The application queries of the promo feature. */
export class PromoApiModule {}
