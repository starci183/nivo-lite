import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./lead-actions.module-definition"
import { LeadActionsQueue } from "./lead-actions.queue"

@Module({ providers: [LeadActionsQueue], exports: [LeadActionsQueue] })
/** The producer imported by the lead-actions capability. */
export class LeadActionsQueueModule extends ConfigurableModuleClass {}
