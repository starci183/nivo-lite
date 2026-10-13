import { Module } from "@nestjs/common"
import { LeadActionsQueue } from "./lead-actions.queue"

@Module({ providers: [LeadActionsQueue], exports: [LeadActionsQueue] })
/** The producer imported by the lead-actions capability. */
export class LeadActionsQueueModule {}
