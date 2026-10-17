import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./data-sync.module-definition"
import { DataSyncQueue } from "./data-sync.queue"

@Module({ providers: [DataSyncQueue], exports: [DataSyncQueue] })
/** The data-sync queue: its typed producer, imported by the domain module whose service enqueues. */
export class DataSyncModule extends ConfigurableModuleClass {}
