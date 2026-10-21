import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { SEED_AGENTS, SEED_AUTH, SEED_CONNECTORS, SEED_SOURCES, SEED_TOOL_GRANTS } from "./workspace-seed.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-seed.module-definition"
import { ProfileActivationService } from "./profile-activation.service"
import { WorkspaceProfileService } from "./workspace-profile.service"
import { WorkspaceSeedService } from "./workspace-seed.service"

@Module({})
/**
 * The demo-workspace seed: accounts through Supabase Auth, the workspace and memberships through their capabilities, and named
 * workspace profiles (brand, agents, grants, documents queued into the knowledge ingestion, Hub rooms) written through the owner
 * classes the app root binds behind the ports.
 */
export class WorkspaceSeedModule extends ConfigurableModuleClass {
    /** Registers the capability once in the cli app; the ports are bound to the owner classes the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { agents, sources, toolGrants, connectors } = options.ports
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: SEED_AUTH, useExisting: options.auth },
                { provide: SEED_AGENTS, useClass: agents },
                { provide: SEED_SOURCES, useClass: sources },
                { provide: SEED_TOOL_GRANTS, useClass: toolGrants },
                { provide: SEED_CONNECTORS, useExisting: connectors },
                KnowledgeQueue,
                WorkspaceSeedService,
                WorkspaceProfileService,
                ProfileActivationService,
            ],
            exports: [WorkspaceSeedService, WorkspaceProfileService],
        }
    }
}
