import { Module, type DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { accountDataEntities, AccountDataModule } from "@modules/domain/account-data"
import { ACCOUNT_DATA_CATALOG } from "@modules/domain/account-data-catalog"
import { GenericWebhookIntakeService } from "@modules/domain/agent-inbound"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import {
    GENERIC_WEBHOOK_QUEUE,
    GENERIC_WEBHOOK_QUEUE_PRODUCER,
    GenericWebhookQueue,
    GenericWebhookQueueModule,
    type GenericWebhookPayload,
} from "@modules/queues/generic-webhook"
import type { LiteWorld } from "./lite-world.service"
import { QUEUE_MODULES } from "./test-capabilities.options"
import { deliveryPublications } from "./proof-database.service"

const [AccountDataEntity] = accountDataEntities

/** The most receipts one proof reads; a scenario delivers a handful. */
const RECEIPTS_MAX = 10

/** The real transactional outbox and its generic webhook producer, with the relay idle during database proofs. */
export const GENERIC_WEBHOOK_QUEUE_MODULES: Array<DynamicModule> = [
    ...QUEUE_MODULES,
    GenericWebhookQueueModule.register({}),
]

@Module({
    providers: [
        GenericWebhookQueue,
        { provide: GENERIC_WEBHOOK_QUEUE_PRODUCER, useExisting: GenericWebhookQueue },
        ConnectionBindingsReadService,
        GenericWebhookIntakeService,
    ],
    exports: [ConnectionBindingsReadService, GenericWebhookIntakeService],
})
/** The real intake of a verified webhook delivery and the connection lookup the account receipt resolves the endpoint with. */
class GenericWebhookIntakeProofModule {}

/** The queue world plus the real intake: a delivery becomes one `webhook.delivery` row of the endpoint's account and one job. */
export const GENERIC_WEBHOOK_INTAKE_MODULES: Array<DynamicModule> = [
    ...GENERIC_WEBHOOK_QUEUE_MODULES,
    { module: GenericWebhookIntakeProofModule, global: true },
    AccountDataModule.withoutPages({ isGlobal: true, types: ACCOUNT_DATA_CATALOG }),
]

/** One receipt the endpoint's account keeps, as a proof reads it back. */
export interface WebhookAccountReceipt {
    /** The row key: the delivery id without its `<endpoint>:` prefix. */
    readonly key: string
    /** What the account records of the delivery. */
    readonly value: object
    /** When its consumer completed it: a type that wakes nothing is never completed. */
    readonly processedAt: Date | null
}

/** The `webhook.delivery` rows the account of one endpoint keeps. */
export const webhookAccountReceipts = async (
    world: LiteWorld,
    connectionId: string,
): Promise<Array<WebhookAccountReceipt>> => {
    const rows = await world.db.primary.find(AccountDataEntity, {
        where: { type: "webhook.delivery", connectionId },
        take: RECEIPTS_MAX,
    })
    return rows.map(({ key, value, processedAt }) => ({ key, value, processedAt }))
}

/** Reads committed delivery state through the world's observer connection while the producer transaction remains open. */
export const observeCommittedWebhookDelivery = (
    world: LiteWorld,
    payload: GenericWebhookPayload,
): ReturnType<typeof deliveryPublications> =>
    deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)

/** A real transaction manager whose connection has closed, so a publication fails at the actual database boundary. */
export const releasedTransactionOf = async (world: LiteWorld): Promise<EntityManager> => {
    const runner = world.db.primary.connection.createQueryRunner()
    await runner.connect()
    try {
        await runner.startTransaction()
        await runner.rollbackTransaction()
    } finally {
        await runner.release()
    }
    return runner.manager
}
