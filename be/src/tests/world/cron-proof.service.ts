import type { CronRow, MessageIdRow } from "../fixtures/persistence/proof.rows"
import assert from "node:assert/strict"
import { mock } from "@starci/jest-preset"
import type { QueueDelivery } from "@modules/platform/queue"
import { PgmqQueueTransportClient } from "@modules/platform/queue"
import type { Logger } from "@modules/platform/logging"
import type { LiteWorld } from "./lite-world.service"
import { queueOptions } from "./test-capabilities.options"
import { CRON, LOCK_TICKS, HIDE_TICKS, TICK_IDS, FIRE_TICK } from "../fixtures/persistence/proof.sql"

/** Executes the installed command, isolates existing ticks, and rolls the entire proof back. */
export const cronProof = async (world: LiteWorld) => {
    const runner = world.db.primary.connection.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    const manager = runner.manager
    const client = new PgmqQueueTransportClient(queueOptions, manager, mock<Logger>())
    try {
        await manager.query(LOCK_TICKS)
        await manager.query(HIDE_TICKS)
        const jobs = await manager.query<Array<CronRow>>(CRON)
        const before = await manager.query<Array<MessageIdRow>>(TICK_IDS)
        await manager.query(FIRE_TICK)
        const after = await manager.query<Array<MessageIdRow>>(TICK_IDS)
        const added = after.filter((row) => !before.some((old) => old.id === row.id))
        assert(added.length === 1, "One cron execution must enqueue exactly one message")
        const deliveries: Array<QueueDelivery> = []
        await client.work(
            {
                queue: "content_tick",
                handle: (delivery) => {
                    deliveries.push(delivery)
                    return Promise.resolve()
                },
            },
            1,
        )
        const expectedId = added[0]?.id
        const untilAcknowledged = async (passes: number): Promise<Array<MessageIdRow>> => {
            const remaining = await manager.query<Array<MessageIdRow>>(TICK_IDS)
            if (passes === 0 || !remaining.some((row) => row.id === expectedId)) return remaining
            await client.wait(5)
            return untilAcknowledged(passes - 1)
        }
        const remaining = await untilAcknowledged(200)
        await client.wait(30)
        return { jobs, added, deliveries, remaining }
    } finally {
        try {
            await client.close()
        } finally {
            try {
                await runner.rollbackTransaction()
            } finally {
                await runner.release()
            }
        }
    }
}
