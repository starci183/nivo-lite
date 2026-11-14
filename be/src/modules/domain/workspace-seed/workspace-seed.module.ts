import { Module, type DynamicModule } from "@nestjs/common"
import { GraphSeedService } from "./graph-seed.service"
import { SeedActivationService } from "./seed-activation.service"
import { SEED_AGENTS, SEED_AUTH } from "./workspace-seed.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-seed.module-definition"
import { WorkspaceSeedService } from "./workspace-seed.service"
import { WorkflowResetCommandService } from "./workflow-reset-command.service"
import { WorkflowResetService } from "./workflow-reset.service"

@Module({})
/**
 * The workspace seed: accounts through the own-auth account doors, the workspace and memberships through their capabilities, and
 * the graph seed of the installed templates, written through the owner class the app root binds behind the agents port.
 */
export class WorkspaceSeedModule extends ConfigurableModuleClass {
    /** Registers the capability once in the cli app; the port is bound to the owner class the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: SEED_AUTH, useExisting: options.auth },
                { provide: SEED_AGENTS, useClass: options.ports.agents },
                SeedActivationService,
                WorkspaceSeedService,
                GraphSeedService,
                WorkflowResetService,
                WorkflowResetCommandService,
            ],
            exports: [WorkspaceSeedService, GraphSeedService, WorkflowResetService, WorkflowResetCommandService],
        }
    }
}
