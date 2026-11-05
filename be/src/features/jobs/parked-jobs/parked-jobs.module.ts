import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./parked-jobs.module-definition"
import { SweepParkedJobsStep } from "./steps/sweep-parked-jobs.step"

@Module({ providers: [SweepParkedJobsStep], exports: [SweepParkedJobsStep] })
/** The application of the parked-jobs job and its single fenced step. */
export class ParkedJobsModule extends ConfigurableModuleClass {}
