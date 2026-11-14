import type { JobClaims, FencedProcessor, ClaimedJob } from "@modules/platform/jobs"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import type { MetaInboxService } from "@modules/domain/meta-inbox"
import type { TelegramInboxService } from "@modules/domain/telegram-inbox"
import type { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import type { EntityManager } from "typeorm"
import { workspacesEntities } from "@modules/domain/workspaces"
import { persistReceiptConnection } from "./account-data.builder"

const WorkspaceEntity: (typeof workspacesEntities)[0] = workspacesEntities[0]

/** The receipt capabilities covered by the delivery processors. */
export type DeliveryKind = "meta" | "telegram" | "sepay"

/** Explicit identities supplied by the world's isolated scenario. */
interface DeliveryFixtureIdentity {
    readonly id: string
    readonly connection: string
    readonly proofId: string
    readonly workspaceId: string
}

/** Actual receipt owners selected by the capability composition. */
interface DeliveryIntakeOwners {
    readonly meta: MetaInboxService
    readonly telegram: TelegramInboxService
    readonly sepay: SepayTransactionsService
}

/** The durable reference shared by every delivery job. */
export interface DeliveryMessage {
    readonly deliveryId: string
}

/** Persists the parent chain required by conversation and payment intake. */
export const persistDeliveryWorkspaceRows = async (
    manager: EntityManager,
    userId: string,
    workspaceId: string,
): Promise<void> => {
    await manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: userId })
        await tx.insert(WorkspaceEntity, { id: workspaceId, ownerId: userId, name: "Delivery proof" })
    })
}

type DeliveryIntakeBuilderResultMessageShape = {
    deliveryId: string
}

type DeliveryIntakeBuilderResultShape = {
    service: MetaInboxService | TelegramInboxService | SepayTransactionsService
    accept: () => Promise<void>
    message: DeliveryIntakeBuilderResultMessageShape
    queue: string
}

/** Intake, rather than a queue producer, creates every durable receipt and publication. */
export const deliveryIntakeBuilder = async (
    manager: EntityManager,
    owners: DeliveryIntakeOwners,
    kind: DeliveryKind,
    identity: DeliveryFixtureIdentity,
): Promise<DeliveryIntakeBuilderResultShape> => {
    const { id, connection, proofId, workspaceId } = identity
    if (kind === "telegram" || kind === "meta") {
        // A door resolves the connection at receipt: an account row needs a live connection, and a Meta event is owned by the
        // connection of its Page.
        await persistReceiptConnection(manager, {
            connectionId: connection,
            workspaceId,
            provider: kind,
            ...(kind === "meta" ? { publicMeta: { page_id: pageIdOf(proofId) } } : {}),
        })
    }
    // Include the whole scenario UUID: fakeIds increments its tail, while its leading group stays fixed per run.
    // Thirteen hex digits keep the provider id inside JavaScript's safe integer range.
    const numericId = Number.parseInt(createHash("sha256").update(id).digest("hex").slice(0, 13), 16)
    const metaBody = metaBodyOf(proofId)
    // Each event of a Meta delivery is one receipt of its Page's account, under `<connection>:<event key>`; the proof id is the message id.
    const deliveryId = {
        meta: `${connection}:dm:${proofId}`,
        telegram: `${connection}:77`,
        sepay: String(numericId),
    }[kind]
    const service = owners[kind]
    const accept = intakeActions(owners, metaBody, connection, numericId)[kind]
    return { service, accept, message: { deliveryId }, queue: `${kind}-delivery` }
}

/** The Page a proof's Meta delivery belongs to. */
const pageIdOf = (proofId: string): string => `page-${proofId}`

/** One signed-shape Meta delivery holding one direct message of a person to the proof's Page; the message id is the proof id. */
const metaBodyOf = (proofId: string): Buffer =>
    Buffer.from(
        JSON.stringify({
            object: "page",
            entry: [
                {
                    id: pageIdOf(proofId),
                    messaging: [
                        {
                            sender: { id: "proof-person" },
                            timestamp: Date.parse("2026-11-12T00:00:00.000Z"),
                            message: { mid: proofId, text: "Hello" },
                        },
                    ],
                },
            ],
        }),
    )

const intakeActions = (owners: DeliveryIntakeOwners, metaBody: Buffer, connection: string, numericId: number) => ({
    meta: () => owners.meta.accept(metaBody, "receipt-proof"),
    telegram: () =>
        owners.telegram.acceptTelegramDelivery(
            Buffer.from(
                JSON.stringify({
                    update_id: 77,
                    message: { message_id: 9, chat: { id: 555 }, text: "Hello", from: { first_name: "Proof" } },
                }),
            ),
            connection,
        ),
    sepay: () =>
        owners.sepay.acceptSepayDelivery({
            authorization: "Apikey delivery-proof-key",
            rawBody: Buffer.from(
                JSON.stringify({ id: numericId, transferType: "in", transferAmount: 100, content: "proof" }),
            ),
        }),
})

type DeliveryClaimBuilderResultDeliveryShape = {
    id: string
    queue: string
    job: string
    payload: DeliveryMessage
    attempt: number
    signal: AbortSignal
}

type DeliveryClaimBuilderResultShape = {
    job: ClaimedJob
    delivery: DeliveryClaimBuilderResultDeliveryShape
    claim: () => Promise<ClaimedJob>
}

/** Reclaims two failed attempts so the original fence-three case uses a real job row. */
export const deliveryClaimBuilder = async (
    claims: JobClaims,
    key: string,
    processor: FencedProcessor,
    message: DeliveryMessage,
): Promise<DeliveryClaimBuilderResultShape> => {
    const claim = async () => {
        const job = await claims.claim({
            kind: processor.queue,
            jobKey: key,
            payload: message,
            workerId: "proof",
            leaseMs: 100,
        })
        assert(job !== null)
        return job
    }
    const first = await claim()
    await claims.fail({ jobId: first.jobId, expectedFencingToken: first.fencingToken, reason: "fixture first attempt" })
    const second = await claim()
    await claims.fail({
        jobId: second.jobId,
        expectedFencingToken: second.fencingToken,
        reason: "fixture second attempt",
    })
    const job = await claim()
    const delivery = {
        id: key,
        queue: processor.queue,
        job: processor.queue,
        payload: message,
        attempt: 1,
        signal: new AbortController().signal,
    }
    return { job, delivery, claim }
}
