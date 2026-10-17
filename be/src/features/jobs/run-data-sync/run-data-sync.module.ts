import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-data-sync.module-definition"
import { RunDataSyncStep } from "./steps/run-data-sync.step"

@Module({ providers: [RunDataSyncStep], exports: [RunDataSyncStep] })
/** The application of the run-data-sync job: its step; the queue transport module imports it. */
export class RunDataSyncModule extends ConfigurableModuleClass {}
