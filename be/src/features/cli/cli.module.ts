import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./cli.module-definition"
import { CleanupWorkspacesModule } from "./cleanup-workspaces/cleanup-workspaces.module"
import { CreateOwnerModule } from "./create-owner/create-owner.module"
import { ConnectChannelModule } from "./connect-channel/connect-channel.module"
import { CliJobsModule } from "./jobs/jobs.module"
import { MailCliModule } from "./mail/mail.module"
import { MigrateModule } from "./migrate/migrate.module"
import { PruneWorkspacesModule } from "./prune-workspaces/prune-workspaces.module"
import { SeedModule } from "./seed/seed.module"
import { SeedAgentGraphsModule } from "./seed-agent-graphs/seed-agent-graphs.module"
import { SeedKnowledgeModule } from "./seed-knowledge/seed-knowledge.module"
import { SeedAutomationsModule } from "./seed-automations/seed-automations.module"
import { SeedManagementModule } from "./seed-management/seed-management.module"
import { SeedMediaModule } from "./seed-media/seed-media.module"
import { SeedModulesModule } from "./seed-modules/seed-modules.module"
import { SeedWorkspaceModule } from "./seed-workspace/seed-workspace.module"
import { StorageCliModule } from "./storage/storage.module"
import { SyncN8nModule } from "./sync-n8n/sync-n8n.module"

@Module({
    imports: [
        CleanupWorkspacesModule.register({}),
        ConnectChannelModule.register({}),
        CreateOwnerModule.register({}),
        CliJobsModule.register({}),
        MailCliModule.register({}),
        MigrateModule.register({}),
        PruneWorkspacesModule.register({}),
        SeedModule.register({}),
        SeedAgentGraphsModule.register({}),
        SeedKnowledgeModule.register({}),
        SeedManagementModule.register({}),
        SeedMediaModule.register({}),
        SeedModulesModule.register({}),
        SeedWorkspaceModule.register({}),
        SeedAutomationsModule.register({}),
        StorageCliModule.register({}),
        SyncN8nModule.register({}),
    ],
})
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule extends ConfigurableModuleClass {}
