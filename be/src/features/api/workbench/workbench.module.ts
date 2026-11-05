import { Module } from "@nestjs/common"
import { WorkbenchActionHandler } from "./application/workbench-action.handler"
import { WorkbenchReadHandler } from "./application/workbench-read.handler"
import { ConfigurableModuleClass } from "./workbench.module-definition"

@Module({ providers: [WorkbenchReadHandler, WorkbenchActionHandler] })
/** The application query and command of the workbench door feature. */
export class WorkbenchApiModule extends ConfigurableModuleClass {}
