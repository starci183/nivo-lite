import { Module } from "@nestjs/common"
import { RunCommandStep } from "./steps/run-command.step"

@Module({ providers: [RunCommandStep], exports: [RunCommandStep] })
/** The application of the run-automation-command job: its step; the queue transport module imports it. */
export class RunAutomationCommandModule {}
