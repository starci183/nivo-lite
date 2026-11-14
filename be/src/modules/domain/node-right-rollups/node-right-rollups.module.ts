import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./node-right-rollups.module-definition"
import { NodeRightRollupsService } from "./node-right-rollups.service"

@Module({})
/**
 * The two read-only roll-ups of the node-level rights (an agent's rights page, a provider's holders). It reads the global
 * capabilities that own the data (agent graphs, the grants, connections, the provider offer, the agents); it owns no table and
 * nothing depends on it but its transport.
 */
export class NodeRightRollupsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), NodeRightRollupsService],
            exports: [NodeRightRollupsService],
        }
    }
}
