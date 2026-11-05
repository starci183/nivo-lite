import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./module-jobs.module-definition"
import { ModuleJobsQueue } from "./module-jobs.queue"

@Module({ providers: [ModuleJobsQueue], exports: [ModuleJobsQueue] })
/** The producer imported by the entity-engine capability. */
export class ModuleJobsQueueModule extends ConfigurableModuleClass {}
