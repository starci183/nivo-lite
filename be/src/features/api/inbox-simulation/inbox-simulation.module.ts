import { Module } from "@nestjs/common"
import { SimulateInboundHandler } from "./application/simulate-inbound.handler"
import { GetInboundSimulationStatusHandler } from "./application/get-inbound-simulation-status.handler"
import { ConfigurableModuleClass } from "./inbox-simulation.module-definition"

@Module({ providers: [SimulateInboundHandler, GetInboundSimulationStatusHandler] })
/** The request and status application handlers of the Inbox simulator. */
export class InboxSimulationApiModule extends ConfigurableModuleClass {}
