import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./fire-thread-deadline.module-definition"
import { FireStep } from "./steps/fire.step"

@Module({ providers: [FireStep], exports: [FireStep] })
/** The application of the fire-thread-deadline job: its step; the queue transport module imports it. */
export class FireThreadDeadlineModule extends ConfigurableModuleClass {}
