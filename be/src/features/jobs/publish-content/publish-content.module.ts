import { Module } from "@nestjs/common"
import { RunAutomationsStep } from "./steps/run-automations.step"

@Module({ providers: [RunAutomationsStep], exports: [RunAutomationsStep] })
/** The application of the publish-content job: its step; the queue transport module imports it. */
export class PublishContentModule {}
