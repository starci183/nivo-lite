import { Module } from "@nestjs/common"
import { TeamChatTurnsApiModule } from "../../team-chat-turns.module"
import { CaptureChatTruthResolver } from "./capture-chat-truth.resolver"
import { ConfigurableModuleClass } from "./team-chat-turns-graphql.module-definition"

@Module({
    imports: [TeamChatTurnsApiModule.register({})],
    providers: [CaptureChatTruthResolver],
})
/** The GraphQL transport of "Ghi vao Second Brain". */
export class TeamChatTurnsGraphqlModule extends ConfigurableModuleClass {}
