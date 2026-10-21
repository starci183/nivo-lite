import { Module } from "@nestjs/common"
import { CleanupWorkspacesCli } from "./cleanup-workspaces.cli"
import { ConfigurableModuleClass } from "./cleanup-workspaces.module-definition"
import { RunCleanupWorkspacesCli } from "./subs/run.cli"

@Module({ providers: [CleanupWorkspacesCli, RunCleanupWorkspacesCli] })
/** The cleanup-workspaces group: the command and its one sub-command over the workspace-cleanup capability. */
export class CleanupWorkspacesModule extends ConfigurableModuleClass {}
