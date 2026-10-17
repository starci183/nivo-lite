import { Module } from "@nestjs/common"
import { GetShellHandler } from "./application/get-shell.handler"
import { ConfigurableModuleClass } from "./shell.module-definition"

@Module({ providers: [GetShellHandler] })
/** The shell feature: the handlers of its application. */
export class ShellApiModule extends ConfigurableModuleClass {}
