import type {
    OutboxRow,
    JobSnapshot,
    ReceiptRow,
    WebhookJobRow,
    WebhookMessageRow,
} from "../fixtures/persistence/proof.rows"
import type { EntityManager } from "typeorm"
import type { QueueReadRow } from "@modules/platform/queue"
import type { LiteWorld } from "./lite-world.service"
import * as statements from "../fixtures/persistence/proof.sql"

/** Reads committed state through the world's observer connection, including while a business transaction is open. */
export const observeQueue = async (world: LiteWorld, proof: string) => ({
    outbox: await outboxRows(world.db.primary, proof),
    messages: await messages(world.db.primary, proof),
})
/** Finds producer rows for one isolated queue proof. */
export const outboxRows = (manager: EntityManager, proof: string) =>
    manager.query<Array<OutboxRow>>(statements.OUTBOX, [proof])
/** Finds the pgmq messages paired with one proof payload. */
export const messages = (manager: EntityManager, proof: string) =>
    manager.query<Array<QueueReadRow>>(statements.MESSAGES, [proof])
/** Reads the persisted lease, token and progress of one delivery. */
export const jobSnapshot = async (manager: EntityManager, key: string) => {
    const rows = await manager.query<Array<JobSnapshot>>(statements.JOB, [key])
    return rows[0]
}
/** Removes only this suite's claim rows after its proofs finish. */
export const cleanupJobs = async (manager: EntityManager, prefix: string): Promise<void> => {
    await manager.query(statements.CLEAN_JOBS, [prefix])
}
/** Finds the durable claim for one signed provider body. */
export const receipts = (manager: EntityManager, id: string) =>
    manager.query<Array<ReceiptRow>>(statements.RECEIPTS, [id])
/** Finds the work published by one provider event. */
export const webhookJobs = (manager: EntityManager, id: string) =>
    manager.query<Array<WebhookJobRow>>(statements.WEBHOOK_JOBS, [id])
/** Reads the actual queue handoff of one provider event. */
export const webhookMessages = (manager: EntityManager, id: string) =>
    manager.query<Array<WebhookMessageRow>>(statements.WEBHOOK_MESSAGES, [id])
/** Registers deletion of one provider delivery and its queue effects. */
export const cleanupWebhook = (world: LiteWorld, mid: string, id: string): void =>
    world.cleanup(async () => {
        await world.db.primary.query(statements.CLEAN_WEBHOOK_MESSAGES, [mid])
        await world.db.primary.query(statements.CLEAN_WEBHOOK_JOBS, [mid])
        await world.db.primary.query(statements.CLEAN_RECEIPT, [id])
    })
/** Registers deletion of one isolated producer handoff. */
export const cleanupQueue = (world: LiteWorld, proof: string): void =>
    world.cleanup(async () => {
        await world.db.primary.query(statements.CLEAN_MESSAGES, [proof])
        await world.db.primary.query(statements.CLEAN_OUTBOX, [proof])
    })

/** Registers removal of the owner/workspace created by a persisting webhook builder. */
export const cleanupWorkspace = (world: LiteWorld, user: string, workspace: string): void =>
    world.cleanup(async () => {
        await world.db.primary.query(statements.CLEAN_WORKSPACE, [workspace])
        await world.db.primary.query(statements.CLEAN_USER, [user])
    })
