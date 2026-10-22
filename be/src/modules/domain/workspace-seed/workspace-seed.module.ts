import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { SEED_OFFICE_AUTHORITY } from "./office-seed.decorators"
import { OfficeSeedService } from "./office-seed.service"
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
        const { agents, sources, toolGrants, connectors, officeAuthority } = options.ports
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: SEED_AUTH, useExisting: options.auth },
                { provide: SEED_AGENTS, useClass: agents },
                { provide: SEED_SOURCES, useClass: sources },
                { provide: SEED_TOOL_GRANTS, useClass: toolGrants },
                { provide: SEED_CONNECTORS, useExisting: connectors },
                officeAuthority === undefined
                    ? { provide: SEED_OFFICE_AUTHORITY, useValue: null }
                    : { provide: SEED_OFFICE_AUTHORITY, useClass: officeAuthority },
                KnowledgeQueue,
                WorkspaceSeedService,
                WorkspaceProfileService,
                ProfileActivationService,
                OfficeSeedService,
            ],
            exports: [WorkspaceSeedService, WorkspaceProfileService, OfficeSeedService],
        }
    }
}
