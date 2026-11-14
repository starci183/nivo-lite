import { Module } from "@nestjs/common"
import { AgentWorkflowStartDeliveryService } from "@modules/domain/agent-graphs"
import { ConfigurableModuleClass } from "./deliver-workflow-start.module-definition"
import { DeliverStartStep } from "./steps/deliver-start.step"

@Module({ providers: [AgentWorkflowStartDeliveryService, DeliverStartStep], exports: [DeliverStartStep] })
/** The application of the workflow-start job: the delivery of a person's start (api only) and its step; the queue transport module imports it. */
export class DeliverWorkflowStartModule extends ConfigurableModuleClass {}
