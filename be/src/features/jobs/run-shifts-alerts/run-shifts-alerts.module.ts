import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-shifts-alerts.module-definition"
import { RunShiftsAlertsStep } from "./steps/run.step"

@Module({ providers: [RunShiftsAlertsStep], exports: [RunShiftsAlertsStep] })
/** The application of the run-shifts-alerts job: its step; the queue transport module imports it. */
export class RunShiftsAlertsModule extends ConfigurableModuleClass {}
