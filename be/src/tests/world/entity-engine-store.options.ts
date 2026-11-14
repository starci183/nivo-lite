import type { DynamicModule } from "@nestjs/common"
import { EntityEngineModule } from "@modules/domain/entity-engine"
import { Secret } from "@modules/platform/config"
import { INSTALLED } from "@modules/domain/installed-plugins"

/** The entity engine as the gateway and the command line compose it: scoped transactions, reads and writes over the records, no jobs. */
export const ENGINE_STORE_MODULE: DynamicModule = EntityEngineModule.register({
    isGlobal: true,
    storeOnly: true,
    entities: INSTALLED.entities(),
    jobs: [],
    cursorKey: new Secret(Buffer.alloc(32, 9).toString("base64")),
})
