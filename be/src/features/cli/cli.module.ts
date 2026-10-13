import { Module } from "@nestjs/common"
import { MigrateModule } from "./migrate/migrate.module"
import { PruneWorkspacesModule } from "./prune-workspaces/prune-workspaces.module"
import { SeedModule } from "./seed/seed.module"
import { SeedModulesModule } from "./seed-modules/seed-modules.module"
import { SeedWorkspaceModule } from "./seed-workspace/seed-workspace.module"

@Module({ imports: [MigrateModule, PruneWorkspacesModule, SeedModule, SeedModulesModule, SeedWorkspaceModule] })
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
