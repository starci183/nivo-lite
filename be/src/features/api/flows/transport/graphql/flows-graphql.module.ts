import { Module } from "@nestjs/common"
import { FlowsApiModule } from "../../flows.module"
import { ConfigurableModuleClass } from "./flows-graphql.module-definition"
import { RunFlowResolver } from "./run-flow.resolver"

@Module({ imports: [FlowsApiModule.register({})], providers: [RunFlowResolver] })
/** The GraphQL transport of the flows feature. */
export class FlowsGraphqlModule extends ConfigurableModuleClass {}
