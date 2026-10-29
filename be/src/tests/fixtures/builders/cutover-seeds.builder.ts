import type { EntityManager } from "typeorm"
import {
    archiveCutoverDelivery,
    archiveEnvelope,
    deleteCutoverDelivery,
    enqueueCutoverProofs,
    insertLegacyClaims,
    insertSentOutboxOnly,
    sendCutoverBusEvent,
    sendCutoverDelivery,
    sendRawEnvelope,
    setCutoverOutboxState,
} from "./cutover.builder"
import type { CutoverEnvelope } from "./cutover.builder"
import { CLAIM_ENVELOPES, READ_ENVELOPES, RENAME_DONE_ENVELOPE } from "./cutover-seeds.sql"

interface EnvelopeRow {
    readonly msgId: string
    readonly proof: string
}

const claimEnvelopes = async (manager: EntityManager, proofs: ReadonlyArray<string>): Promise<void> => {
    await manager.query(CLAIM_ENVELOPES, [proofs])
}

const readEnvelopes = async (
    manager: EntityManager,
    proofs: ReadonlyArray<string>,
): Promise<Array<CutoverEnvelope>> => {
    const rows = await manager.query<Array<EnvelopeRow>>(READ_ENVELOPES, [proofs])
    return rows.map(({ msgId, proof }) => ({ msgId: Number(msgId), proof }))
}

/** Seeds the durable deliveries a cutover must carry over, writing only columns the pre-expand schema has. */
export const seedCutoverOutbox = async (manager: EntityManager): Promise<void> => {
    await enqueueCutoverProofs(manager, ["queued", "inflight", "dead", "done"])
    await claimEnvelopes(manager, ["inflight"])
    await setCutoverOutboxState(manager, "inflight", { state: "running", attempts: 1, startedAt: () => "now()" })
    await archiveCutoverDelivery(manager, "dead")
    await setCutoverOutboxState(manager, "dead", {
        state: "failed",
        finishedAt: () => "now()",
        lastError: "Synthetic dead letter",
    })
    await deleteCutoverDelivery(manager, "done")
    await setCutoverOutboxState(manager, "done", { state: "done", finishedAt: () => "now()", lastError: null })
    await insertSentOutboxOnly(manager, "outbox-only")
    await sendCutoverDelivery(manager, "queued")
}

/** Seeds raw cron envelopes and dead letters the cutover adopts: raw envelopes have no outbox id, raw dead letters no ledger row. */
export const seedCutoverRaw = async (manager: EntityManager): Promise<void> => {
    for (const proof of ["raw", "raw-inflight", "raw-dead", "raw-done"]) await sendRawEnvelope(manager, proof)
    await claimEnvelopes(manager, ["raw-inflight", "raw-done"])
    for (const envelope of await readEnvelopes(manager, ["raw-dead"])) await archiveEnvelope(manager, envelope)
    await insertLegacyClaims(manager, await readEnvelopes(manager, ["raw-inflight", "raw-done"]))
    await manager.query(RENAME_DONE_ENVELOPE)
    await sendCutoverBusEvent(manager)
}
