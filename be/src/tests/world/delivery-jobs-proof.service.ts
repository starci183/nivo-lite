import { MetaInboxService } from "@modules/domain/meta-inbox"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { JobClaims, FencedProcessor } from "@modules/platform/jobs"
import type { LiteWorld } from "./lite-world.service"
import { cleanupJobs, cleanupWorkspace } from "./proof-database.service"
import {
    persistDeliveryWorkspaceRows,
    deliveryIntakeBuilder,
    deliveryClaimBuilder,
} from "../fixtures/builders/delivery-jobs.builder"
import type { DeliveryKind } from "../fixtures/builders/delivery-jobs.builder"
import type { ReceiptRow, WebhookJobRow, WebhookMessageRow } from "../fixtures/persistence/proof.rows"
import * as statements from "../fixtures/builders/delivery-jobs.sql"

/** Owns cleanup while a persisting builder creates the scenario's parent rows. */
export const persistDeliveryWorkspace = async (world: LiteWorld, workspaceId: string): Promise<void> => {
    const userId = world.id()
    cleanupWorkspace(world, userId, workspaceId)
    world.cleanup(() => world.db.primary.query(statements.CLEAN_CREDITS, [workspaceId]))
    world.cleanup(() => cleanupJobs(world.db.primary, world.prefix))
    await persistDeliveryWorkspaceRows(world.db.primary, userId, workspaceId)
}

/** Observes and cleans up the real intake arranged by a persisting builder. */
export const deliveryIntakeFixture = async (world: LiteWorld, kind: DeliveryKind, workspaceId: string) => {
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
        await world.db.primary.query(statements.CLEAN_MESSAGES, [kind, deliveryId])
        await world.db.primary.query(statements.CLEAN_PUBLICATIONS, [fixture.queue, deliveryId])
        await world.db.primary.query(statements.CLEAN_RECEIPTS, [kind, deliveryId])
    })
    const state = async () => ({
        receipts: await world.db.primary.query<Array<ReceiptRow>>(statements.RECEIPTS, [kind, deliveryId]),
        jobs: await world.db.primary.query<Array<WebhookJobRow>>(statements.PUBLICATIONS, [fixture.queue, deliveryId]),
        messages: await world.db.primary.query<Array<WebhookMessageRow>>(statements.MESSAGES, [kind, deliveryId]),
    })
    return { ...fixture, state }
}

/** Adds call-through observations to a real receipt and third-fence job arranged by the builders. */
export const deliveryJobBuilder = async (
    world: LiteWorld,
    kind: DeliveryKind,
    workspaceId: string,
    processor: FencedProcessor,
) => {
    const fixture = await deliveryIntakeFixture(world, kind, workspaceId)
    await fixture.accept()
    const claims = world.resolve<JobClaims>(JOB_CLAIMS)
    const built = await deliveryClaimBuilder(claims, world.key(world.id()), processor, fixture.message)
    const advance = claims.advance.bind(claims)
    const progress = { advance: jest.spyOn(claims, "advance") }
    const inbox = { processRecordedDelivery: jest.spyOn(fixture.service, "processRecordedDelivery") }
    return { ...fixture, ...built, processor, claims, progress, inbox, advance }
}
