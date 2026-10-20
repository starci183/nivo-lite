import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { SEED_AUTH } from "./workspace-seed.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-seed.module-definition"
import { WorkspaceProfileService } from "./workspace-profile.service"
import { WorkspaceSeedService } from "./workspace-seed.service"

@Module({})
/**
 * The demo-workspace seed: accounts through Supabase Auth, the workspace and memberships through their capabilities, and named
 * workspace profiles (brand, agents, grants, documents queued into the knowledge ingestion, Hub rooms).
 */
export class WorkspaceSeedModule extends ConfigurableModuleClass {
    /** Registers the capability once in the cli app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), KnowledgeQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: SEED_AUTH, useExisting: options.auth },
                WorkspaceSeedService,
                WorkspaceProfileService,
            ],
            exports: [WorkspaceSeedService, WorkspaceProfileService],
        }
    }
}
