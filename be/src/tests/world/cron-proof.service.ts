import type { CronRow, TickRow } from "../fixtures/persistence/proof.rows"
import assert from "node:assert/strict"
import type { LiteWorld } from "./lite-world.service"
import { CRON, LOCK_TICKS, HIDE_TICKS, TICK_IDS, FIRE_TICK } from "../fixtures/persistence/proof.sql"

/** Executes the installed command, isolates existing ticks, and rolls the entire proof back. */
export const cronProof = async (world: LiteWorld) => {
    const runner = world.db.primary.connection.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    const manager = runner.manager
    try {
        await manager.query(LOCK_TICKS)
        await manager.query(HIDE_TICKS)
        const jobs = await manager.query<Array<CronRow>>(CRON)
        const before = await manager.query<Array<TickRow>>(TICK_IDS)
        await manager.query(FIRE_TICK)
        const after = await manager.query<Array<TickRow>>(TICK_IDS)
        const added = after.filter((row) => !before.some((old) => old.id === row.id))
        assert(added.length === 1, "One cron execution must enqueue exactly one outbox row")
        return { jobs, added }
    } finally {
        try {
            await runner.rollbackTransaction()
        } finally {
            await runner.release()
        }
    }
}
