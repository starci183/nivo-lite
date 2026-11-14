import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AccountDataReadService, AccountDataTypesService, type AccountDataTypeDef } from "@modules/domain/account-data"
import { accountKeyOf } from "@modules/domain/account-data/account-data-value.policy"
import { bankTransactionTriggerFor, feedTransactionRowsOf } from "@modules/domain/bank-feed-inbox"
import type { BankFeedProvider } from "@modules/domain/bank-feed-inbox/bank-feed-inbox.contracts"
import { cassoTransaction, payosTransaction, sepayTransaction } from "@modules/domain/bank-feed-inbox/bank-feed.data-types"
import { ConnectionsService } from "@modules/domain/connections"
import { PaymentInstructionRegistryService } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { PAYMENT_TOOL, PaymentNativeService } from "./payment-native.service"

// RULING R51 ITEM 2 on the REAL shapes: a bank feed's REAL intake row (`feedTransactionRowsOf`, keyed by the REAL type's key rule
// `accountKeyOf`), the REAL bank trigger's translate of that row (what a run's `trigger.data.transactionId` is), and the REAL credit read
// asked with exactly that id. On dev 2026-11-14 every payment run froze here: the trigger handed `sepay:94624259` (the provider's id, the
// row's KEY) and the tool read the row by its uuid (`invalid input syntax for type uuid`). The store double keeps the two apart as the
// database does: `get` by (account, type, key), `byId` by the row's own uuid.

/** One stored row of the account store: the uuid the database gives it, the key its type's rule gives it, its account, its value. */
interface Kept {
    readonly id: string
    readonly connectionId: string
    readonly type: string
    readonly key: string
    readonly value: Readonly<Record<string, unknown>>
}

/** The three bank feeds: the door's claim name, the provider, its transaction type, and the id a webhook of it carries. */
const FEEDS: ReadonlyArray<readonly [BankFeedProvider, "sepay" | "casso" | "payos", AccountDataTypeDef, string]> = [
    ["sepay-feed", "sepay", sepayTransaction, "sepay:94624259"],
    ["casso", "casso", cassoTransaction, "casso:770011"],
    ["payos", "payos", payosTransaction, "payos:FT26318000123"],
]

const build = async (kept: ReadonlyArray<Kept>) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockImplementation((_workspaceId: string, id: string) =>
        Promise.resolve(connectionRecord({ id, provider: FEEDS.find(([, provider]) => `conn-${provider}` === id)?.[1] ?? "sepay", name: "Bank" })),
    )
    const rows = mock<AccountDataReadService>()
    rows.get.mockImplementation((connectionId: string, type: string, key: string) => {
        const row = kept.find((one) => one.connectionId === connectionId && one.type === type && one.key === key)
        return Promise.resolve(
            row === undefined
                ? null
                : { id: row.id, type: row.type, typeVersion: 1, key: row.key, value: row.value, occurredAt: new Date("2026-11-14T02:42:50.000Z"), processedAt: null },
        )
    })
    rows.byId.mockImplementation((type: string, id: string) => {
        const row = kept.find((one) => one.type === type && one.id === id)
        return Promise.resolve(
            row === undefined
                ? null
                : {
                      id: row.id,
                      type: row.type,
                      typeVersion: 1,
                      key: row.key,
                      value: row.value,
                      occurredAt: new Date("2026-11-14T02:42:50.000Z"),
                      processedAt: null,
                      connectionId: row.connectionId,
                      createdAt: "2026-11-14T02:42:50.000000Z",
                  },
        )
    })
    const types = mock<AccountDataTypesService>()
    types.all.mockReturnValue(FEEDS.map(([, , type]) => type))
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentNativeService,
            { provide: ConnectionsService, useValue: connections },
            { provide: PaymentInstructionRegistryService, useValue: new PaymentInstructionRegistryService() },
            { provide: AccountDataReadService, useValue: rows },
            { provide: AccountDataTypesService, useValue: types },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentNativeService), rows }
}

describe("a bank credit: the id the trigger hands a run is the id the credit read takes (ruling R51 item 2)", () => {
    it.each(FEEDS)("%s: intake row -> trigger event -> payment.credit.get by the event's own transactionId", async (door, provider, type, eventId) => {
        const connectionId = `conn-${provider}`
        // The intake: one webhook credit becomes the feed's transaction row, kept under its type's key; the database gives it a uuid.
        const [input] = feedTransactionRowsOf(door, {
            connection: connectionId,
            credits: [{ amount: 250000, content: "CK DH-20261114-0001", eventId, fallbackBankName: "Bank", occurredAt: "2026-11-14T02:42:49.000Z" }],
        })
        expect(input?.type).toBe(type.name)
        const value = Object.fromEntries(Object.entries(input?.value ?? {}))
        const kept: Kept = { id: "0b8f6a2e-1c4d-4e5f-8a9b-000000000042", connectionId, type: type.name, key: accountKeyOf(type, value), value }
        // The trigger: the REAL declaration translates the kept row into the event a run reads.
        const declaration = bankTransactionTriggerFor(provider)
        const event = declaration?.translate(declaration.raw.parse(kept.value), { connectionId }) ?? null
        expect(event?.id).toBe(eventId)
        expect(event?.data.transactionId).toBe(eventId)

        const { service, rows } = await build([kept])
        const credit = await service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: event?.data.transactionId ?? "" }, { agentId: "agent-sales", conversationId: null, connectionId, provider })

        // One id form end to end: the answer's id is the event's own id, read by the row's key on the handed account.
        expect(credit).toMatchObject({ id: eventId, direction: "in", amountVnd: 250000, content: "CK DH-20261114-0001" })
        expect(rows.get).toHaveBeenCalledWith(connectionId, type.name, eventId)
        expect(rows.byId).not.toHaveBeenCalled()
    })
})
