import { Module } from "@nestjs/common"
import { FlowsApiModule } from "../../flows.module"
import { RunFlowResolver } from "./run-flow.resolver"

@Module({ imports: [FlowsApiModule], providers: [RunFlowResolver] })
/** The GraphQL transport of the flows feature. */
export class FlowsGraphqlModule {}
