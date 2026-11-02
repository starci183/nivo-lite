import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import type { EnvSource } from "@modules/platform/config"
import type { parsePrimaryDatabaseConfig } from "@modules/platform/database"

interface ProofTargetRow {
    readonly database: string
    readonly schema: string
    readonly address: string
    readonly port: number
    readonly migrations: number
    readonly latest: boolean
}

/** Refuses a coordinated private proof before any scene writes unless its actual connection matches the migrated target. */
export const assertProofTarget = async (
    manager: EntityManager,
    config: ReturnType<typeof parsePrimaryDatabaseConfig>,
    env: EnvSource,
): Promise<void> => {
    const expected = env.optional("NIVO_PROOF_DATABASE")
    if (expected === undefined) return
    assert(/^nivo_output_proof_codex_[a-z0-9_]+$/.test(expected), "Expected an owned private proof database")
    assert.equal(
        new URL(config.url.reveal()).pathname,
        `/${expected}`,
        "World configuration must name the private target",
    )
    assert.equal(config.schema, "public", "Private proof schema must be public")
    const rows = await manager.query<Array<ProofTargetRow>>(`
        SELECT current_database() AS database, current_schema() AS schema,
               inet_server_addr()::text AS address, inet_server_port() AS port,
               (SELECT count(*)::integer FROM supabase_migrations.schema_migrations) AS migrations,
               (SELECT max(version) = '20261110101200' FROM supabase_migrations.schema_migrations) AS latest
    `)
    const [actual] = rows
    assert(actual, "Private proof database must answer its target preflight")
    assert.equal(actual.database, expected)
    assert.equal(actual.schema, config.schema)
    assert.equal(actual.address, env.string("NIVO_PROOF_SERVER_ADDRESS"))
    assert.equal(actual.port, env.int("NIVO_PROOF_SERVER_PORT"))
    assert.equal(actual.migrations, env.int("NIVO_PROOF_MIGRATIONS"))
    assert(actual.latest, "Private target must include the final public approval migration")
    process.stdout.write(`[nivo-proof-target] ${JSON.stringify(actual)}\n`)
}
