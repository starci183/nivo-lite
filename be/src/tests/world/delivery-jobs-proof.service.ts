import {
    type JobClaims,
    type FencedProcessor,
    type ClaimedJob,
    type AdvanceWrite,
    JOB_CLAIMS,
} from "@modules/platform/jobs"
import { MetaInboxService } from "@modules/domain/meta-inbox"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import type { LiteWorld } from "./lite-world.service"
import {
    cleanupJobs,
    cleanupWorkspace,
    deliveryEnvelopes,
    deliveryPublications,
    removeCreditOutbox,
    removeDeliveryOutbox,
} from "./proof-database.service"
import {
    persistDeliveryWorkspaceRows,
    deliveryIntakeBuilder,
    deliveryClaimBuilder,
    type DeliveryKind,
    type DeliveryMessage,
} from "../fixtures/builders/delivery-jobs.builder"
import { receiptsOf, removeReceipts } from "./receipts-database.service"
import type { MetaDeliveryRecorded } from "@modules/queues/meta-delivery"
import type { SepayDeliveryRecorded } from "@modules/queues/sepay-delivery"
import type { TelegramDeliveryRecorded } from "@modules/queues/telegram-delivery"
import type { ReceiptRow, WebhookJobRow, WebhookMessageRow } from "@tests/fixtures/persistence/proof.rows"

/** Owns cleanup while a persisting builder creates the scenario's parent rows. */
export const persistDeliveryWorkspace = async (world: LiteWorld, workspaceId: string): Promise<void> => {
    const userId = world.id()
    cleanupWorkspace(world, userId, workspaceId)
    world.cleanup(() => removeCreditOutbox(world.db.primary, workspaceId))
    world.cleanup(() => cleanupJobs(world.db.primary, world.prefix))
    await persistDeliveryWorkspaceRows(world.db.primary, userId, workspaceId)
}

type DeliveryIntakeFixtureResultMessageShape = {
    deliveryId: string
}

type DeliveryIntakeFixtureResultStateShape = {
    receipts: ReadonlyArray<ReceiptRow>
    jobs: Array<WebhookJobRow>
    messages: Array<WebhookMessageRow>
}

type DeliveryIntakeFixtureResultShape = {
    state: () => Promise<DeliveryIntakeFixtureResultStateShape>
    service: MetaInboxService | TelegramInboxService | SepayTransactionsService
    accept: () => Promise<void>
    message: DeliveryIntakeFixtureResultMessageShape
    queue: string
}

/** Observes and cleans up the real intake arranged by a persisting builder. */
export const deliveryIntakeFixture = async (
    world: LiteWorld,
    kind: DeliveryKind,
    workspaceId: string,
): Promise<DeliveryIntakeFixtureResultShape> => {
    const id = world.id()
    const fixture = await deliveryIntakeBuilder(
        world.db.primary,
        {
            meta: world.resolve(MetaInboxService),
            telegram: world.resolve(TelegramInboxService),
            sepay: world.resolve(SepayTransactionsService),
        },
        kind,
        { id, connection: world.id(), proofId: world.key(id), workspaceId },
    )
    const deliveryId = fixture.message.deliveryId
    world.cleanup(async () => {
        await removeDeliveryOutbox(world.db.primary, fixture.queue, deliveryId)
        await removeReceipts(world.db.primary, kind, deliveryId)
    })
    const state = async () => ({
        receipts: await receiptsOf(world.db.primary, kind, deliveryId),
        jobs: await deliveryPublications(world.db.primary, fixture.queue, deliveryId),
        messages: await deliveryEnvelopes(world.db.primary, fixture.queue, deliveryId),
    })
    return { ...fixture, state }
}

type DeliveryJobBuilderResultDeliveryShape = {
    id: string
    queue: string
    job: string
    payload: DeliveryMessage
    attempt: number
    signal: AbortSignal
}

type DeliveryJobBuilderResultInboxShape = {
    processRecordedDelivery: jest.SpyInstance<
        Promise<void>,
        [message: MetaDeliveryRecorded] | [message: TelegramDeliveryRecorded] | [message: SepayDeliveryRecorded]
    >
}

type DeliveryJobBuilderResultProgressShape = {
    advance: jest.SpyInstance<Promise<void>, [write: AdvanceWrite]>
}

type DeliveryJobBuilderResultShape = {
    processor: FencedProcessor
    claims: JobClaims
    progress: DeliveryJobBuilderResultProgressShape
    inbox: DeliveryJobBuilderResultInboxShape
    advance: (write: AdvanceWrite) => Promise<void>
    job: ClaimedJob
    delivery: DeliveryJobBuilderResultDeliveryShape
    claim: () => Promise<ClaimedJob>
    state: () => Promise<DeliveryIntakeFixtureResultStateShape>
    service: MetaInboxService | TelegramInboxService | SepayTransactionsService
    accept: () => Promise<void>
    message: DeliveryIntakeFixtureResultMessageShape
    queue: string
}

/** Adds call-through observations to a real receipt and third-fence job arranged by the builders. */
export const deliveryJobBuilder = async (
    world: LiteWorld,
    kind: DeliveryKind,
    workspaceId: string,
    processor: FencedProcessor,
): Promise<DeliveryJobBuilderResultShape> => {
    const fixture = await deliveryIntakeFixture(world, kind, workspaceId)
    await fixture.accept()
    const claims = world.resolve<JobClaims>(JOB_CLAIMS)
    const built = await deliveryClaimBuilder(claims, world.key(world.id()), processor, fixture.message)
    const advance = claims.advance.bind(claims)
    const progress = { advance: jest.spyOn(claims, "advance") }
    const inbox = { processRecordedDelivery: jest.spyOn(fixture.service, "processRecordedDelivery") }
    return { ...fixture, ...built, processor, claims, progress, inbox, advance }
}
