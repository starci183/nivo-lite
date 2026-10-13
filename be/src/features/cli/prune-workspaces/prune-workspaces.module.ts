import { Module } from "@nestjs/common"
import { PruneWorkspacesCli } from "./prune-workspaces.cli"
import { RunPruneWorkspacesCli } from "./subs/run.cli"

@Module({ providers: [PruneWorkspacesCli, RunPruneWorkspacesCli] })
/** The prune-workspaces group: the command and its one sub-command over the workspace-prune capability. */
export class PruneWorkspacesModule {}
