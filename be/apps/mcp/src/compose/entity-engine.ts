import type { DynamicModule } from "@nestjs/common"
import { EntityEngineModule } from "@modules/domain/entity-engine"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import type { McpAppOptions } from "../mcp.options"

/** The entity engine as this app composes it: scoped transactions, reads and writes over the records (the graph of each agent), no queue and no jobs. */
export const entityEngineStoreModules = (options: McpAppOptions): Array<DynamicModule> => [
    EntityEngineModule.register({
        isGlobal: true,
        storeOnly: true,
        entities: FLOW_F_ENTITIES,
        jobs: [],
        cursorKey: options.entityEngine.cursorKey,
        buildId: options.entityEngine.buildId,
    }),
]
