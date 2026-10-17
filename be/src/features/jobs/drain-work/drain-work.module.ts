import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./drain-work.module-definition"
import { DrainWorkStep } from "./steps/drain-work.step"

@Module({ providers: [DrainWorkStep], exports: [DrainWorkStep] })
/** The application of the drain-work job: its step; the queue transport module imports it. */
export class DrainWorkModule extends ConfigurableModuleClass {}
