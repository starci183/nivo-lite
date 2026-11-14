import { Module } from "@nestjs/common"
import { AgentsCli } from "./agents.cli"
import { ConfigurableModuleClass } from "./agents.module-definition"
import { InstallWorkflowsCli } from "./subs/install-workflows.cli"

@Module({ providers: [AgentsCli, InstallWorkflowsCli] })
/** The agents group: the command and its sub-command that gives agents the workflows their plugins ship. */
export class AgentsCliModule extends ConfigurableModuleClass {}
