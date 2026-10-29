import type {
    OutboxRow,
    JobSnapshot,
    ReceiptRow,
    WebhookJobRow,
    WebhookMessageRow,
    ObservedMessageRow,
} from "../fixtures/persistence/proof.rows"
import type { EntityManager } from "typeorm"
import { jobsEntities } from "@modules/platform/jobs"
import type { LiteWorld } from "./lite-world.service"
import * as statements from "./proof.sql"
import { removeAuthUsers, removeWorkspace } from "./proof-accounts.service"
import { receiptsOf, removeReceipts } from "./receipts-database.service"

const [JobEntity] = jobsEntities

/** Reads committed state through the world's observer connection, including while a business transaction is open. */
export const observeQueue = async (world: LiteWorld, proof: string) => ({
    outbox: await outboxRows(world.db.primary, proof),
    messages: await messages(world.db.primary, proof),
})
/** Finds producer rows for one isolated queue proof. */
export const outboxRows = (manager: EntityManager, proof: string) =>
    manager.query<Array<OutboxRow>>(statements.OUTBOX, [proof])
/** Finds the broker-bound envelopes paired with one proof payload, reconstructed from the outbox. */
export const messages = (manager: EntityManager, proof: string) =>
    manager.query<Array<ObservedMessageRow>>(statements.MESSAGES, [proof])
/** Reads the persisted lease, token and progress of one delivery. */
export const jobSnapshot = async (manager: EntityManager, key: string): Promise<JobSnapshot | undefined> => {
    const job = await manager.findOne(JobEntity, { where: { jobKey: key } })
    if (job === null) return undefined
    return {
        id: job.id,
        status: job.status,
        fencing_token: String(job.fencingToken),
        current_step: job.currentStep,
        error: job.error,
    }
}
/** Removes only this suite's claim rows after its proofs finish. */
export const cleanupJobs = async (manager: EntityManager, prefix: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobEntity, "t")
        .delete()
        .where("starts_with(job_key, :prefix)", { prefix })
        .execute()
}
/** Finds the durable claim for one signed provider body. */
export const receipts = (manager: EntityManager, id: string): Promise<ReadonlyArray<ReceiptRow>> =>
    receiptsOf(manager, "meta", id)
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
        await removeReceipts(world.db.primary, "meta", id)
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
        await removeWorkspace(world.db.primary, workspace)
        await removeAuthUsers(world.db.primary, [user])
    })
