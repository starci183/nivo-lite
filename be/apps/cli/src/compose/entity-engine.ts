import type { DynamicModule } from "@nestjs/common"
import { EntityEngineModule } from "@modules/domain/entity-engine"
import { WorkspaceSettingsModule } from "@modules/domain/workspace-settings"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { CliAppOptions } from "../cli.options"

/** The entity engine as this app composes it: scoped transactions, reads and writes over the records (the graph of each agent), no queue and no jobs. */
export const entityEngineStoreModules = (options: CliAppOptions): Array<DynamicModule> => [
    EntityEngineModule.register({
        isGlobal: true,
        storeOnly: true,
        entities: INSTALLED.entities(),
        jobs: [],
        cursorKey: options.entityEngine.cursorKey,
        buildId: options.entityEngine.buildId,
    }),
    // The workspace's own settings and its time zone: they read the core workspaces row over the primary connection.
    WorkspaceSettingsModule.register({ isGlobal: true }),
]
