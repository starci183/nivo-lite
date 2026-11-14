import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./sync-vectors.module-definition"
import { SyncRowsStep } from "./steps/sync-rows.step"

@Module({ providers: [SyncRowsStep], exports: [SyncRowsStep] })
/** The application of the sync-vectors job: its step; the queue transport module imports it. */
export class SyncVectorsModule extends ConfigurableModuleClass {}
