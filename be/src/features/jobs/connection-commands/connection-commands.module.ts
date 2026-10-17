import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./connection-commands.module-definition"
import { RunCommandStep } from "./steps/run-command.step"

@Module({ providers: [RunCommandStep], exports: [RunCommandStep] })
/** The application of the connection-commands job: its step; the queue transport module imports it. */
export class ConnectionCommandsJobModule extends ConfigurableModuleClass {}
