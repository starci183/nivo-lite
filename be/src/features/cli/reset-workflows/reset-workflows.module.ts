import { Module } from "@nestjs/common"
import { ResetWorkflowsCli } from "./reset-workflows.cli"
import { ConfigurableModuleClass } from "./reset-workflows.module-definition"

@Module({ providers: [ResetWorkflowsCli] })
/** The reset-workflows command over the workflow reset of the workspace-seed capability. */
export class ResetWorkflowsModule extends ConfigurableModuleClass {}
