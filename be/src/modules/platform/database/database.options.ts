import type { Secret } from "@modules/platform/config"

/** What the primary connection parser reads from the environment. */
export interface DatabaseConnectionConfig {
    /** The logical connection name declared in `hfs.json`. */
    readonly name: string
    /** The Supabase PostgreSQL provider; schema changes remain under `db/migrations`. */
    readonly provider: "supabase"
    /** The dedicated least-privilege application role's connection URL. */
    readonly url: Secret
}

/** Runtime connection options add only the isolated PostgreSQL schema; entities come from the apps, migrations stay under `db/migrations`. */
export interface DatabaseConnectionOptions extends DatabaseConnectionConfig {
    /** The schema named by the `hfs.json` isolation contract. */
    readonly schema?: string
}

/** Options of the database capability. */
export interface DatabaseOptions {
    /** The integration-owned type parsers created separately for each app connection. */
    readonly typeParsers: () => unknown
    /**
     * Every entity class the app maps, normally `PRIMARY_ENTITIES` from `platform/database/entities`.
     * It is an option rather than an import because the capability barrels that list entities import this capability.
     */
    readonly entities: ReadonlyArray<new () => object>
    /** The connections this app opens; one per physical database. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}
