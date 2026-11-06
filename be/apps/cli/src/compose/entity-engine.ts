import type { DynamicModule } from "@nestjs/common"
import { EntityEngineModule } from "@modules/domain/entity-engine"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import type { CliAppOptions } from "../cli.options"

/** The entity engine as this app composes it: scoped transactions, reads and writes over the records (the graph of each agent), no queue and no jobs. */
export const entityEngineStoreModules = (options: CliAppOptions): Array<DynamicModule> => [
    EntityEngineModule.register({
        isGlobal: true,
        storeOnly: true,
        entities: FLOW_F_ENTITIES,
        jobs: [],
        cursorKey: options.entityEngine.cursorKey,
        buildId: options.entityEngine.buildId,
    }),
]
