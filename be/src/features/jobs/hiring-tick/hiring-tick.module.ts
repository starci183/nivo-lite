import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./hiring-tick.module-definition"
import { RunHiringTickStep } from "./steps/run-hiring-tick.step"

@Module({ providers: [RunHiringTickStep], exports: [RunHiringTickStep] })
/** The application of the hiring-tick job: its step; the queue transport module imports it. */
export class HiringTickModule extends ConfigurableModuleClass {}
