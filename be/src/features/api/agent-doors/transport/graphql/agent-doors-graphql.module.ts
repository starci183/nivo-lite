import { Module } from "@nestjs/common"
import { AgentDoorsApiModule } from "../../agent-doors.module"
import { ConfigurableModuleClass } from "./agent-doors-graphql.module-definition"
import { AgentDoorsResolver } from "./agent-doors.resolver"

@Module({
    imports: [AgentDoorsApiModule.register({})],
    providers: [AgentDoorsResolver],
})
/** The GraphQL transport of the agent-doors feature. */
export class AgentDoorsGraphqlModule extends ConfigurableModuleClass {}
