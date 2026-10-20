import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-accounting-morning.module-definition"
import { RunAccountingMorningStep } from "./steps/run.step"

@Module({ providers: [RunAccountingMorningStep], exports: [RunAccountingMorningStep] })
/** The application of the run-accounting-morning job: its step; the queue transport module imports it. */
export class RunAccountingMorningModule extends ConfigurableModuleClass {}
