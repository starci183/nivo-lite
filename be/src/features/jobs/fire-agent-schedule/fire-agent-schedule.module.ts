import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./fire-agent-schedule.module-definition"
import { FireStep } from "./steps/fire.step"

@Module({ providers: [FireStep], exports: [FireStep] })
/** The application of the fire-agent-schedule job: its step; the queue transport module imports it. */
export class FireAgentScheduleModule extends ConfigurableModuleClass {}
