import { Module } from "@nestjs/common"
import { ChattypingApiModule } from "../../chattyping.module"
import { ChatTypingResolver } from "./chat-typing.resolver"
import { ConfigurableModuleClass } from "./chattyping-graphql.module-definition"

@Module({ imports: [ChattypingApiModule.register({})], providers: [ChatTypingResolver] })
/** The GraphQL transport of chat typing. */
export class ChattypingGraphqlModule extends ConfigurableModuleClass {}
