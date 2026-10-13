import { Module } from "@nestjs/common"
import { LeadGenQueue } from "./lead-gen.queue"

@Module({ providers: [LeadGenQueue], exports: [LeadGenQueue] })
/** The producer imported by the lead-flows capability. */
export class LeadGenQueueModule {}
