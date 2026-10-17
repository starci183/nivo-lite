import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
/** The public capability modules composed for one suite. */
export interface LiteWorldOptions {
    readonly modules: ReadonlyArray<DynamicModule>
}
/** The migrated local database available to specs and persisting builders. */
export interface WorldDatabase {
    readonly primary: EntityManager
}
