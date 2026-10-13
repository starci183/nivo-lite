import { Module } from "@nestjs/common"
import { FlowsApiModule } from "../../flows.module"
import { FlowsController } from "./flows.controller"

@Module({ imports: [FlowsApiModule], controllers: [FlowsController] })
/** The HTTP transport of the flows feature. */
export class FlowsHttpModule {}
