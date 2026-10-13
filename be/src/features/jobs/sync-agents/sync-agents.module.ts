import { Module } from "@nestjs/common"
import { SyncAgentsStep } from "./steps/sync-agents.step"

@Module({ providers: [SyncAgentsStep], exports: [SyncAgentsStep] })
/** The application of the sync-agents job: its step; the queue transport module imports it. */
export class SyncAgentsModule {}
