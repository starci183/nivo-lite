import { Module } from "@nestjs/common"
import { AccountDataCliModule } from "./account-data/account-data.module"
import { AgentsCliModule } from "./agents/agents.module"
import { ConfigurableModuleClass } from "./cli.module-definition"
import { BrainPoliciesCliModule } from "./brain-policies/brain-policies.module"
import { CleanupWorkspacesModule } from "./cleanup-workspaces/cleanup-workspaces.module"
import { EntitySchemaModule } from "./entity-schema/entity-schema.module"
import { CreateOwnerModule } from "./create-owner/create-owner.module"
import { ConnectChannelModule } from "./connect-channel/connect-channel.module"
import { CliJobsModule } from "./jobs/jobs.module"
import { MailCliModule } from "./mail/mail.module"
import { MigrateModule } from "./migrate/migrate.module"
import { OpenApiCliModule } from "./openapi/openapi.module"
import { PruneWorkspacesModule } from "./prune-workspaces/prune-workspaces.module"
import { ResetWorkflowsModule } from "./reset-workflows/reset-workflows.module"
import { SeedModule } from "./seed/seed.module"
import { SeedAgentGraphsModule } from "./seed-agent-graphs/seed-agent-graphs.module"
import { SeedBrainModule } from "./seed-brain/seed-brain.module"
import { SeedKnowledgeModule } from "./seed-knowledge/seed-knowledge.module"
import { SeedManagementModule } from "./seed-management/seed-management.module"
import { SeedModulesModule } from "./seed-modules/seed-modules.module"
import { SeedEnterpriseModule } from "./seed-enterprise/seed-enterprise.module"
import { SeedChatModule } from "./seed-chat/seed-chat.module"
import { SeedRecordsModule } from "./seed-records/seed-records.module"
import { SeedTestAccountsModule } from "./seed-test-accounts/seed-test-accounts.module"
import { SeedWorkspaceModule } from "./seed-workspace/seed-workspace.module"
import { StorageCliModule } from "./storage/storage.module"
import { ToolsCliModule } from "./tools/tools.module"

@Module({
    imports: [
        AccountDataCliModule.register({}),
        AgentsCliModule.register({}),
        BrainPoliciesCliModule.register({}),
        CleanupWorkspacesModule.register({}),
        ConnectChannelModule.register({}),
        CreateOwnerModule.register({}),
        EntitySchemaModule.register({}),
        CliJobsModule.register({}),
        MailCliModule.register({}),
        MigrateModule.register({}),
        OpenApiCliModule.register({}),
        PruneWorkspacesModule.register({}),
        ResetWorkflowsModule.register({}),
        SeedModule.register({}),
        SeedAgentGraphsModule.register({}),
        SeedBrainModule.register({}),
        SeedKnowledgeModule.register({}),
        SeedManagementModule.register({}),
        SeedModulesModule.register({}),
        SeedEnterpriseModule.register({}),
        SeedRecordsModule.register({}),
        SeedChatModule.register({}),
        SeedTestAccountsModule.register({}),
        SeedWorkspaceModule.register({}),
        StorageCliModule.register({}),
        ToolsCliModule.register({}),
    ],
})
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule extends ConfigurableModuleClass {}
