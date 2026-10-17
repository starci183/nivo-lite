import { Module } from "@nestjs/common"
import { PromoApiModule } from "../../promo.module"
import { ConfigurableModuleClass } from "./promo-graphql.module-definition"
import { PromoStateResolver } from "./promo-state.resolver"
import { PromoChatbotStateResolver } from "./chatbot-state.resolver"
import { FoundingMemberResolver } from "./founding-member.resolver"
import { LeadWaitResolver } from "./lead-wait.resolver"

@Module({
    imports: [PromoApiModule.register({})],
    providers: [PromoStateResolver, PromoChatbotStateResolver, FoundingMemberResolver, LeadWaitResolver],
})
/** The GraphQL transport of promo reads. */
export class PromoGraphqlModule extends ConfigurableModuleClass {}
