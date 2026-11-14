import type { EntityManager } from "typeorm"
import { accountDataEntities } from "@modules/domain/account-data"
import { persistReceiptAccount } from "../fixtures/builders/account-data.builder"
import type { LiteWorld } from "./lite-world.service"
import { cleanupWorkspace } from "./proof-database.service"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { WAITING_ON_LOCK } from "./workbench-door-proof.sql"

const [AccountDataEntity] = accountDataEntities

/** How many times a race looks for the second statement blocked behind the first, and how long it waits between looks. */
const BLOCK_POLLS = 200
const BLOCK_POLL_MS = 25

/** The most rows one proof reads back of a type of its account; the proofs write a handful. */
const ROWS_MAX = 100

/** One side of a race: a unit of work run in its own transaction. */
export type RaceSide<T> = (tx: EntityManager) => Promise<T>

/** What the two sides of a race answered, the first committed one first. */
export type RaceResults<T> = readonly [T, T]

/** One stored row of the account as a proof reads it back. */
export interface AccountDataProofRow {
    /** The row key. */
    readonly key: string
    /** The stored value. */
    readonly value: object
    /** When its consumer completed it; null while pending. */
    readonly processedAt: Date | null
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** True when some statement of the database waits for a lock now. */
const someoneWaits = async (manager: EntityManager): Promise<boolean> => {
    const [row] = await manager.query<Array<{ waiting: number }>>(WAITING_ON_LOCK, [])
    return row !== undefined && row.waiting > 0
}

/** Resolves once a statement waits for a lock; refuses when none does within the polls. */
const blockedWithin = async (manager: EntityManager, polls: number): Promise<void> => {
    if (await someoneWaits(manager)) return
    if (polls <= 0) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { lock: "never waited" } })
    await pause(BLOCK_POLL_MS)
    await blockedWithin(manager, polls - 1)
}

/**
 * Runs two transactions that truly overlap: the first does its work and stays open until the second's statement is blocked behind it
 * on the database, then commits; the second finishes after it. Answers both results, the first's first.
 */
export const raced = async <T>(manager: EntityManager, first: RaceSide<T>, second: RaceSide<T>): Promise<RaceResults<T>> => {
    const later: Array<Promise<T>> = []
    // The second side runs on ITS OWN transaction on purpose, while the first is still open: that overlap is what the race proves.
    const startSecond = (): void => {
        later.push(manager.transaction((other) => second(other)))
    }
    const secondBlocked = (): Promise<void> => blockedWithin(manager, BLOCK_POLLS)
    const firstResult = await manager.transaction(async (tx) => {
        const result = await first(tx)
        startSecond()
        await secondBlocked()
        return result
    })
    const [secondResult] = await Promise.all(later)
    if (secondResult === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { race: "second" } })
    return [firstResult, secondResult]
}

/** The account a proof persisted: its workspace and its connection. */
export interface ProofAccount {
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The connection (the account). */
    readonly connectionId: string
}

/** Persists an owner, a workspace and one live connection of the provider, removed with the world. */
export const persistProofAccount = async (world: LiteWorld, provider: string): Promise<ProofAccount> => {
    const userId = world.id()
    const workspaceId = world.id()
    const connectionId = world.id()
    cleanupWorkspace(world, userId, workspaceId)
    await persistReceiptAccount(world.db.primary, { userId, workspaceId, connectionId, provider })
    return { workspaceId, connectionId }
}

/** The stored rows of one type of the connection, as committed. */
export const accountRowsOf = async (
    manager: EntityManager,
    connectionId: string,
    type: string,
): Promise<Array<AccountDataProofRow>> => {
    const rows = await manager.find(AccountDataEntity, {
        where: { type, connectionId },
        order: { key: "ASC" },
        take: ROWS_MAX,
    })
    return rows.map((row) => ({ key: row.key, value: row.value, processedAt: row.processedAt }))
}

/** Ages the rows of one type of the connection on the database clock, as if they happened `interval` ago. */
export const ageRows = async (
    manager: EntityManager,
    connectionId: string,
    type: string,
    interval: string,
): Promise<void> => {
    await manager
        .createQueryBuilder(AccountDataEntity, "r")
        .update()
        .set({ occurredAt: () => "now() - CAST(:age AS interval)" })
        .where("type = :type AND connection_id = :connectionId", { type, connectionId })
        .setParameter("age", interval)
        .execute()
}
