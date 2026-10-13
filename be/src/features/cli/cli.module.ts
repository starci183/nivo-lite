import { Module } from "@nestjs/common"
import { MigrateModule } from "./migrate/migrate.module"
import { PruneWorkspacesModule } from "./prune-workspaces/prune-workspaces.module"
import { SeedModule } from "./seed/seed.module"
import { SeedAutomationsModule } from "./seed-automations/seed-automations.module"
import { SeedModulesModule } from "./seed-modules/seed-modules.module"
import { SeedWorkspaceModule } from "./seed-workspace/seed-workspace.module"
import { SyncN8nModule } from "./sync-n8n/sync-n8n.module"
import { SimulateSepayModule } from "./simulate-sepay/simulate-sepay.module"

@Module({
    imports: [
        MigrateModule,
        PruneWorkspacesModule,
        SeedModule,
        SeedModulesModule,
        SeedWorkspaceModule,
        SeedAutomationsModule,
        SyncN8nModule,
        SimulateSepayModule,
    ],
})
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
