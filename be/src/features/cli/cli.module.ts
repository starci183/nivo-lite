import { Module } from "@nestjs/common"
import { ConnectChannelModule } from "./connect-channel/connect-channel.module"
import { MigrateModule } from "./migrate/migrate.module"
import { PruneWorkspacesModule } from "./prune-workspaces/prune-workspaces.module"
import { SeedModule } from "./seed/seed.module"
import { SeedKnowledgeModule } from "./seed-knowledge/seed-knowledge.module"
import { SeedAutomationsModule } from "./seed-automations/seed-automations.module"
import { SeedMediaModule } from "./seed-media/seed-media.module"
import { SeedModulesModule } from "./seed-modules/seed-modules.module"
import { SeedWorkspaceModule } from "./seed-workspace/seed-workspace.module"
import { SyncN8nModule } from "./sync-n8n/sync-n8n.module"
import { SimulateSepayModule } from "./simulate-sepay/simulate-sepay.module"

@Module({
    imports: [
        ConnectChannelModule,
        MigrateModule,
        PruneWorkspacesModule,
        SeedModule,
        SeedKnowledgeModule,
        SeedMediaModule,
        SeedModulesModule,
        SeedWorkspaceModule,
        SeedAutomationsModule,
        SyncN8nModule,
        SimulateSepayModule,
    ],
})
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
