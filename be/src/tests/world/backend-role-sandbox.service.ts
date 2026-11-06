import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig, sql } from "@modules/platform/database"
import type { WorldSandbox } from "./test-world.contracts"

const SELECT_ROLE = sql`SELECT current_user AS role`

/** The connection option that makes every statement of a connection run as the back-end role. */
const AS_BACKEND = "-c role=app_be"

/** The URL of the migrated database the caller named, as the plain (superuser) world reaches it: what a proof seeds its scene through. */
export const seedDatabaseUrl = (): string => parsePrimaryDatabaseConfig(EnvSource.fromProcess()).url.reveal()

/**
 * A world whose own connection is the back-end role: the database the caller named (`PRIMARY_DB_URL`, a scratch database migrated from
 * the bootstrap and every migration) is reached with `role=app_be`, so every statement of the app under test meets the grants and the
 * row-level policies the deployed app meets. A proof seeds its scene through `seedDatabaseUrl`, which bypasses them on purpose.
 */
export const backendRoleSandbox = (): WorldSandbox => ({
    create(): Promise<string> {
        const url = new URL(seedDatabaseUrl())
        assert(/^\/[a-z0-9_]+$/.test(url.pathname), "The back-end proof needs a named local database")
        url.searchParams.set("options", AS_BACKEND)
        return Promise.resolve(url.toString())
    },
    drop: () => Promise.resolve(),
})

/** The role the connection of a manager runs as. */
export const currentRole = async (manager: EntityManager): Promise<string | undefined> => {
    const [row] = await manager.query<Array<{ role: string }>>(SELECT_ROLE)
    return row?.role
}
