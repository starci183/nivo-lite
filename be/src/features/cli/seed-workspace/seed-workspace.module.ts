import { Module } from "@nestjs/common"
import { SeedWorkspaceCli } from "./seed-workspace.cli"
import { ConfigurableModuleClass } from "./seed-workspace.module-definition"
import { RunSeedWorkspaceCli } from "./subs/run.cli"

@Module({ providers: [SeedWorkspaceCli, RunSeedWorkspaceCli] })
/** The seed-workspace group: the command and its one sub-command over the workspace-seed capability. */
export class SeedWorkspaceModule extends ConfigurableModuleClass {}
