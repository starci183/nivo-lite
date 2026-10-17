import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./lead-gen.module-definition"
import { LeadGenQueue } from "./lead-gen.queue"

@Module({ providers: [LeadGenQueue], exports: [LeadGenQueue] })
/** The producer imported by the lead-flows capability. */
export class LeadGenQueueModule extends ConfigurableModuleClass {}
