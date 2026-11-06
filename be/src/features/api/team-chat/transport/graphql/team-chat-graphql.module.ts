import { Module } from "@nestjs/common"
import { TeamChatApiModule } from "../../team-chat.module"
import { ConfigurableModuleClass } from "./team-chat-graphql.module-definition"
import { TeamChatResolver } from "./team-chat.resolver"

@Module({
    imports: [TeamChatApiModule.register({})],
    providers: [TeamChatResolver],
})
/** GraphQL contract of the internal team chat. */
export class TeamChatGraphqlModule extends ConfigurableModuleClass {}
