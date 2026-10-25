import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
/** A throwaway database for a proof that needs a schema of its own; its schema work is done outside the test sources. */
export interface WorldSandbox {
    /** Creates the database at the schema the proof starts from and answers its connection URL. */
    readonly create: () => Promise<string>
    /** Removes the database after the world released its connections. */
    readonly drop: () => Promise<void>
}
/** The public capability modules composed for one suite, and the sandbox it runs on instead of the migrated local database. */
export interface LiteWorldOptions {
    readonly modules: ReadonlyArray<DynamicModule>
    readonly sandbox?: WorldSandbox
}
/** The migrated local database available to specs and persisting builders. */
export interface WorldDatabase {
    readonly primary: EntityManager
}
