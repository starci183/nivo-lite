import assert from "node:assert/strict"
import { QueryFailedError } from "typeorm"
import type { EntityManager, QueryRunner } from "typeorm"
import { callDbFunction } from "@modules/platform/database"
import type { SqlText } from "@modules/platform/database"
import type { LiteWorld } from "./lite-world.service"
import {
    AS_BACKEND_LOCAL,
    AS_BACKEND_SESSION,
    IDENTITY,
    RELEASE_PROBE,
    RESET_AUTHORIZATION,
    ROLLBACK_TO_PROBE,
    SAVEPOINT_PROBE,
} from "./entity-engine-scope.sql"

/** The role and the workspace a statement runs under. */
export interface ScopeIdentity {
    readonly role: string
    readonly session: string
    readonly workspace: string | null
}

/** The SQLSTATE a driver error carries, or null for anything else (a guard, never a cast). */
export const sqlstateOf = (error: unknown): string | null => {
    if (!(error instanceof QueryFailedError)) return null
    const driver: unknown = error.driverError
    if (typeof driver !== "object" || driver === null || !("code" in driver)) return null
    return typeof driver.code === "string" ? driver.code : null
}

/** One connection of the proof, authorized as the back-end role (the world connects as a superuser that bypasses RLS). */
export class ScopeProbe {
    constructor(
        /** The transaction-owning runner. */
        readonly runner: QueryRunner,
    ) {}

    /** The manager of the connection, for the builders and statements of the proof. */
    get manager(): EntityManager {
        return this.runner.manager
    }

    /** Runs one statement and answers its rows. */
    rows<Row>(text: SqlText, params: ReadonlyArray<unknown> = []): Promise<Array<Row>> {
        return this.runner.manager.query<Array<Row>>(text, [...params])
    }

    /** Opens the engine scope of a workspace, as the first statement of an engine transaction. */
    async enter(workspaceId: string): Promise<void> {
        await callDbFunction(this.runner.manager, "public.engine_scope_enter", [workspaceId])
    }

    /** The role and workspace of the transaction right now. */
    async identity(): Promise<ScopeIdentity> {
        const [row] = await this.rows<{ role: string; session: string; workspace: string | null }>(IDENTITY)
        assert(row, "The identity probe must answer a row")
        return row
    }

    /**
     * Runs a statement the database may refuse inside a savepoint, so the transaction goes on.
     * Answers the SQLSTATE of the refusal, or null when the statement was accepted.
     */
    async refusal(statement: SqlText, params: ReadonlyArray<unknown> = []): Promise<string | null> {
        await this.rows(SAVEPOINT_PROBE)
        try {
            await this.rows(statement, params)
        } catch (error) {
            const code = sqlstateOf(error)
            if (code === null) throw error
            await this.rows(ROLLBACK_TO_PROBE)
            return code
        }
        await this.rows(RELEASE_PROBE)
        return null
    }

    /**
     * Runs a write the database may refuse inside a savepoint, so the transaction goes on.
     * Answers the SQLSTATE of the refusal, or null when the write was accepted.
     */
    async attempt(write: (manager: EntityManager) => Promise<unknown>): Promise<string | null> {
        await this.rows(SAVEPOINT_PROBE)
        try {
            await write(this.runner.manager)
        } catch (error) {
            const code = sqlstateOf(error)
            if (code === null) throw error
            await this.rows(ROLLBACK_TO_PROBE)
            return code
        }
        await this.rows(RELEASE_PROBE)
        return null
    }

    /** Tries to open the scope with a value that may be null; answers the SQLSTATE of the refusal, or null when accepted. */
    async refusalToEnter(workspaceId: string | null): Promise<string | null> {
        await this.rows(SAVEPOINT_PROBE)
        try {
            await callDbFunction(this.runner.manager, "public.engine_scope_enter", [workspaceId])
        } catch (error) {
            const code = sqlstateOf(error)
            if (code === null) throw error
            await this.rows(ROLLBACK_TO_PROBE)
            return code
        }
        await this.rows(RELEASE_PROBE)
        return null
    }

    /** Starts the transaction of the engine. */
    begin(): Promise<void> {
        return this.runner.startTransaction()
    }

    /** Ends the transaction by commit. */
    commit(): Promise<void> {
        return this.runner.commitTransaction()
    }

    /** Ends the transaction by rollback. */
    rollback(): Promise<void> {
        return this.runner.rollbackTransaction()
    }
}

/**
 * Runs a proof inside one transaction that is always rolled back, authorized as app_be for that transaction only.
 * The first statement is `SET LOCAL SESSION AUTHORIZATION app_be` (the coordinator ruling for every isolation case).
 */
export const withBackendTransaction = async (
    world: LiteWorld,
    proof: (probe: ScopeProbe) => Promise<void>,
): Promise<void> => {
    const runner = world.db.primary.connection.createQueryRunner()
    try {
        await runner.connect()
        const probe = new ScopeProbe(runner)
        await probe.begin()
        await probe.rows(AS_BACKEND_LOCAL)
        const who = await probe.identity()
        assert.equal(who.role, "app_be", "The isolation proof must execute as app_be")
        await proof(probe)
    } finally {
        try {
            if (runner.isTransactionActive) await runner.rollbackTransaction()
        } finally {
            await runner.release()
        }
    }
}

/**
 * Runs a proof on one connection authorized as app_be for the whole session, with no transaction open: the proof owns
 * begin, commit and rollback, to show what a pooled connection carries after each. The authorization is reset before
 * the connection goes back to the pool.
 */
export const withBackendSession = async (
    world: LiteWorld,
    proof: (probe: ScopeProbe) => Promise<void>,
): Promise<void> => {
    const runner = world.db.primary.connection.createQueryRunner()
    try {
        await runner.connect()
        const probe = new ScopeProbe(runner)
        await probe.rows(AS_BACKEND_SESSION)
        await proof(probe)
    } finally {
        try {
            if (runner.isTransactionActive) await runner.rollbackTransaction()
            await runner.manager.query(RESET_AUTHORIZATION)
        } finally {
            await runner.release()
        }
    }
}

/**
 * Runs the transactions of a concurrent proof, each on its own connection and each committed, scoped to a workspace
 * as the engine does: begin, authorize as app_be, enter the scope, work, commit. A failure rolls that transaction back
 * and is answered as its SQLSTATE next to the others.
 */
export const concurrentScopedTransactions = <Result>(
    world: LiteWorld,
    workspaceId: string,
    work: ReadonlyArray<(probe: ScopeProbe) => Promise<Result>>,
): Promise<Array<{ readonly result: Result | null; readonly sqlstate: string | null }>> =>
    Promise.all(
        work.map(async (step) => {
            const runner = world.db.primary.connection.createQueryRunner()
            try {
                await runner.connect()
                const probe = new ScopeProbe(runner)
                await probe.begin()
                try {
                    await probe.rows(AS_BACKEND_LOCAL)
                    await probe.enter(workspaceId)
                    const result = await step(probe)
                    await probe.commit()
                    return { result, sqlstate: null }
                } catch (error) {
                    const sqlstate = sqlstateOf(error)
                    if (sqlstate === null) throw error
                    if (runner.isTransactionActive) await probe.rollback()
                    return { result: null, sqlstate }
                }
            } finally {
                await runner.release()
            }
        }),
    )

/** Reads the catalog or a privilege fact on the world connection (a superuser): the probes of the schema spec. */
export const catalogRows = <Row>(
    world: LiteWorld,
    statement: SqlText,
    params: ReadonlyArray<unknown> = [],
): Promise<Array<Row>> => world.db.primary.query<Array<Row>>(statement, [...params])
