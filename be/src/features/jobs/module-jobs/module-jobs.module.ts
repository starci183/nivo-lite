import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./module-jobs.module-definition"
import { RunModuleJobStep } from "./steps/run-module-job.step"

@Module({ providers: [RunModuleJobStep], exports: [RunModuleJobStep] })
/** The application of the module-job job and its single fenced step. */
export class ModuleJobsModule extends ConfigurableModuleClass {}
