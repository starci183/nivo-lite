import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, type MockEntityManager } from "@starci/jest-preset"
import type { AccountWrite } from "@modules/domain/account-data"
import { bankTransactionTriggerFor, feedTransactionRowsOf, type IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BankFeedTriggerService } from "./bank-feed-trigger.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const OWNER = { provider: "sepay", connectionId: "conn-1", workspaceId: "ws-1" }

const credit = (eventId: string, change: Partial<IncomingCredit> = {}): IncomingCredit => ({
    amount: 150_000,
    content: "NIVO8F3K2",
    eventId,
    fallbackBankName: "SePay",
    occurredAt: "2026-11-12T04:00:00Z",
    ...change,
})

/** The transaction rows the feed's intake writes of these movements (its own normaliser). */
const rowsOf = (...credits: ReadonlyArray<IncomingCredit>) => feedTransactionRowsOf("sepay-feed", { connection: "conn-1", credits })

/** What the intake answered: one row per movement, `true` for a row it inserted. */
const written = (...fresh: ReadonlyArray<boolean>): AccountWrite => ({
    owner: OWNER,
    rows: fresh.map((isNew, index) => ({ type: "sepay.transaction", key: `k${index}`, id: isNew ? `row-${index}` : "", isNew })),
})

/** A manager whose nested transaction runs its work on itself, as a savepoint does. */
const savepointManager = (): MockEntityManager => {
    const manager = mockEntityManager()
    manager.transaction.mockImplementation(async (...args: ReadonlyArray<unknown>) => {
        const work = args.at(-1)
        if (typeof work !== "function") throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no work" } })
        const done: unknown = await Reflect.apply(work, undefined, [manager])
        return done
    })
    return manager
}

const build = async (world: { readonly environment?: string } = {}) => {
    const tx = savepointManager()
    const connections = mock<ConnectionBindingsReadService>()
    connections.stateOf.mockResolvedValue({ name: "Bank", environment: world.environment ?? "live" })
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue({ status: "delivered", events: 0, dropped: 0, woken: [], repeats: 0, untaken: 0, held: 0 })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedTriggerService,
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: ProviderTriggersService, useValue: triggers },
        ],
    }).compile()
    return { service: moduleRef.get(BankFeedTriggerService), tx, connections, triggers, logger }
}

describe("BankFeedTriggerService", () => {
    it("hands each new movement to the ONE delivery as its feed's trigger translates the stored row, with the row as its inbox", async () => {
        const { service, tx, triggers } = await build()

        await service.emit(tx, OWNER, rowsOf(credit("sepay:1"), credit("sepay:2", { direction: "debit" })), written(true, true))

        expect(triggers.deliver).toHaveBeenCalledTimes(1)
        expect(triggers.deliver).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                declaration: bankTransactionTriggerFor("sepay"),
                connectionId: "conn-1",
                agentId: null,
                events: [
                    {
                        event: {
                            id: "sepay:1",
                            data: { transactionId: "sepay:1", direction: "in", amountVnd: 150_000, content: "NIVO8F3K2", at: "2026-11-12T04:00:00.000Z" },
                        },
                        raw: { type: "sepay.transaction", id: "row-0" },
                        occurredAt: "2026-11-12T04:00:00.000Z",
                    },
                    {
                        event: {
                            id: "sepay:2",
                            data: { transactionId: "sepay:2", direction: "out", amountVnd: 150_000, content: "NIVO8F3K2", at: "2026-11-12T04:00:00.000Z" },
                        },
                        raw: { type: "sepay.transaction", id: "row-1" },
                        occurredAt: "2026-11-12T04:00:00.000Z",
                    },
                ],
            },
            tx,
        )
    })

    it("carries no payer in an event and names no person (a movement has no subject)", async () => {
        const { service, tx, triggers } = await build()

        await service.emit(tx, OWNER, rowsOf(credit("sepay:1", { payer: "NGUYEN VAN A" })), written(true))

        const [delivered] = triggers.deliver.mock.calls[0]?.[0].events ?? []
        expect(Object.keys(delivered?.event.data ?? {})).not.toContain("payer")
        expect(delivered?.event.subject).toBeUndefined()
    })

    it("leaves out a movement the account already kept, and delivers nothing when no movement is new", async () => {
        const { service, tx, triggers } = await build()

        await service.emit(tx, OWNER, rowsOf(credit("sepay:1"), credit("sepay:2")), written(false, true))
        expect(triggers.deliver.mock.calls[0]?.[0].events.map((one) => one.event.id)).toEqual(["sepay:2"])

        triggers.deliver.mockClear()
        await service.emit(tx, OWNER, rowsOf(credit("sepay:1")), written(false))
        expect(triggers.deliver).not.toHaveBeenCalled()
    })

    it("delivers nothing for an account in the provider's test environment, or of a provider that is no bank feed", async () => {
        const test = await build({ environment: "test" })
        await test.service.emit(test.tx, OWNER, rowsOf(credit("sepay:1")), written(true))
        expect(test.triggers.deliver).not.toHaveBeenCalled()

        const other = await build()
        await other.service.emit(other.tx, { ...OWNER, provider: "imap" }, rowsOf(credit("sepay:1")), written(true))
        expect(other.triggers.deliver).not.toHaveBeenCalled()
    })

    it("never throws: a failure of the delivery is logged and the kept rows stand", async () => {
        const { service, tx, triggers, logger } = await build()
        triggers.deliver.mockRejectedValue(new Error("down"))

        await expect(service.emit(tx, OWNER, rowsOf(credit("sepay:1")), written(true))).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})
