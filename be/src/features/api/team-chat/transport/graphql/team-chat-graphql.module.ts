import { Module } from "@nestjs/common"
import { TeamChatApiModule } from "../../team-chat.module"
import { ConfigurableModuleClass } from "./team-chat-graphql.module-definition"
import { TeamChatReactionsResolver } from "./team-chat-reactions.resolver"
import { TeamChatResolver } from "./team-chat.resolver"

@Module({
    imports: [TeamChatApiModule.register({})],
    providers: [TeamChatResolver, TeamChatReactionsResolver],
})
/** GraphQL contract of the internal team chat. */
export class TeamChatGraphqlModule extends ConfigurableModuleClass {}
