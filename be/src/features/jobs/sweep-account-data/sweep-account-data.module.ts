import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./sweep-account-data.module-definition"
import { SweepAccountDataStep } from "./steps/sweep-account-data.step"

@Module({ providers: [SweepAccountDataStep], exports: [SweepAccountDataStep] })
/** The application of the sweep-account-data job: its step; the queue transport module imports it. */
export class SweepAccountDataModule extends ConfigurableModuleClass {}
