import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { TransactionsErrorCode } from "./errors/transactions.error"
import { TransactionEntity } from "./persistence/entities"
import type { NewTransaction, TransactionAccountingRow, TransactionRow } from "./transactions.contracts"
import { TransactionsService } from "./transactions.service"

const transactionOf = builder<TransactionRow>({
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: "in-1",
    amount_vnd: 500000,
    reference: "DH-20261013-0001",
    payer: "Minh",
    invoice_id: null,
    status: "unmatched",
})

/** The stored payment the contract row of `transactionOf` maps from. */
const entityOf = (patch: Partial<TransactionEntity> = {}): TransactionEntity =>
    Object.assign(new TransactionEntity(), {
        id: "tx-1",
        workspaceId: "ws-1",
        inboundEventId: "in-1",
        channel: "bank",
        amountVnd: 500000,
        reference: "DH-20261013-0001",
        payer: "Minh",
        occurredAt: new Date("2026-10-13T02:00:00.000Z"),
        invoiceId: null,
        status: "unmatched",
        createdAt: new Date("2026-10-13T02:00:01.000Z"),
        direction: "credit",
        ...patch,
    })

const payment: NewTransaction = {
    workspaceId: "ws-1",
    inboundEventId: "in-1",
    amountVnd: 500000,
    reference: "DH-20261013-0001",
    payer: "Minh",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [TransactionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(TransactionsService)
}

const managerWith = (
    fake: ReturnType<typeof fakeQueryBuilder>,
    stubs: Parameters<typeof mockEntityManager>[0] = {},
) => {
    const manager = mockEntityManager(stubs)
    manager.createQueryBuilder.mockReturnValue(fake.builder as never)
    return manager
}

/** The key of the payment the specs read and settle. */
const PAYMENT_KEY = { workspaceId: "ws-1", id: "tx-1" }

const RETURNING =
    "id, workspace_id, inbound_event_id, amount_vnd::float8 AS amount_vnd, reference, payer, invoice_id, status"

describe("TransactionsService", () => {
    describe("find", () => {
        it("answers the payment of the workspace, or null", async () => {
            const em = mockEntityManager({
                findOne: [
                    [TransactionEntity, entityOf()],
                    [TransactionEntity, null],
                ],
            })
            const transactions = await build(em)

            await expect(transactions.find("ws-1", "tx-1")).resolves.toEqual(transactionOf())
            await expect(transactions.find("ws-1", "missing")).resolves.toBeNull()
            expect(em.findOne.mock.calls).toEqual([
                [TransactionEntity, { where: PAYMENT_KEY }],
                [TransactionEntity, { where: { workspaceId: "ws-1", id: "missing" } }],
            ])
        })
    })
})

const TEXT_OCCURRED = "to_json(t.occurred_at) #>> '{}' AS occurred_at"
const TEXT_CREATED = "to_json(t.created_at) #>> '{}' AS created_at"

describe("TransactionsService", () => {
    describe("momentOf", () => {
        it("answers the money and the moment of the payment as the old text, or null", async () => {
            const read = fakeQueryBuilder({
                getRawOne: {
                    amount_vnd: 500000,
                    payer: "Minh",
                    reference: null,
                    occurred_at: "2026-10-13T02:00:00.000000+00:00",
                },
            })
            const missing = fakeQueryBuilder({ getRawOne: undefined })
            const em = mockEntityManager()
            em.createQueryBuilder
                .mockReturnValueOnce(read.builder as never)
                .mockReturnValueOnce(missing.builder as never)
            const transactions = await build(em)

            await expect(transactions.momentOf("ws-1", "tx-1")).resolves.toEqual({
                amount_vnd: 500000,
                payer: "Minh",
                reference: null,
                occurred_at: "2026-10-13T02:00:00.000000+00:00",
            })
            await expect(transactions.momentOf("ws-1", "missing")).resolves.toBeNull()
            expect(em.createQueryBuilder).toHaveBeenCalledWith(TransactionEntity, "t")
            expect(read.callsOf("select")).toEqual([
                [["t.amount_vnd::float8 AS amount_vnd", "t.payer AS payer", "t.reference AS reference", TEXT_OCCURRED]],
            ])
            expect(read.callsOf("where")).toEqual([
                [
                    "t.workspace_id = :workspaceId AND t.id = :transactionId",
                    { workspaceId: "ws-1", transactionId: "tx-1" },
                ],
            ])
            expect(read.callsOf("limit")).toEqual([[1]])
        })
    })
})

describe("TransactionsService", () => {
    describe("listForInvoices", () => {
        it("reads nothing for no invoices", async () => {
            const em = mockEntityManager()
            const transactions = await build(em)

            await expect(transactions.listForInvoices("ws-1", [])).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("reads the payments of the given invoices, oldest first, with the old timestamp text", async () => {
            const view = {
                ...transactionOf({ invoice_id: "invoice-1", status: "matched" }),
                channel: "bank",
                occurred_at: "2026-10-13T02:00:00.000000+00:00",
                created_at: "2026-10-13T02:00:01.000000+00:00",
            }
            const read = fakeQueryBuilder({ getRawMany: [view] })
            const transactions = await build(managerWith(read))

            await expect(transactions.listForInvoices("ws-1", ["invoice-1"])).resolves.toEqual([view])
            expect(read.callsOf("select")[0]?.[0]).toEqual(expect.arrayContaining([TEXT_OCCURRED, TEXT_CREATED]))
            expect(read.callsOf("where")).toEqual([
                [
                    "t.workspace_id = :workspaceId AND t.invoice_id IN (:...invoiceIds)",
                    { workspaceId: "ws-1", invoiceIds: ["invoice-1"] },
                ],
            ])
            expect(read.callsOf("orderBy")).toEqual([["t.created_at", "ASC"]])
            expect(read.callsOf("addOrderBy")).toEqual([["t.id", "ASC"]])
            expect(read.callsOf("limit")).toEqual([[1000]])
        })
    })
})

describe("TransactionsService", () => {
    describe("listAccounting", () => {
        const raw = {
            id: "tx-1",
            workspace_id: "ws-1",
            inbound_event_id: "in-1",
            channel: "bank",
            amount_vnd: 500000,
            reference: "DH-20261013-0001",
            payer: "Minh",
            invoice_id: null,
            status: "unmatched",
            occurred_at: "2026-10-13T02:00:00.000000+00:00",
            created_at: "2026-10-13T02:00:01.000000+00:00",
            inbound_id: null,
            inbound_channel: null,
            inbound_event: null,
            inbound_body: null,
            inbound_sender_name: null,
        }

        it("reads the newest payments, a thousand by default", async () => {
            const read = fakeQueryBuilder({ getRawMany: [raw] })
            const em = managerWith(read)
            const transactions = await build(em)
            const expected: TransactionAccountingRow = {
                ...transactionOf(),
                channel: "bank",
                occurred_at: "2026-10-13T02:00:00.000000+00:00",
                created_at: "2026-10-13T02:00:01.000000+00:00",
                inbound: null,
            }

            await expect(transactions.listAccounting("ws-1")).resolves.toEqual([expected])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(TransactionEntity, "t")
            expect(read.callsOf("select")[0]?.[0]).toEqual(
                expect.arrayContaining(["t.amount_vnd::float8 AS amount_vnd", TEXT_OCCURRED, TEXT_CREATED]),
            )
            expect(read.callsOf("where")).toEqual([["t.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
            expect(read.callsOf("orderBy")).toEqual([["t.occurred_at", "DESC"]])
            expect(read.callsOf("addOrderBy")).toEqual([["t.id", "DESC"]])
            expect(read.callsOf("limit")).toEqual([[1000]])
        })

        it("bounds the read by the limit given and joins the input of the same workspace", async () => {
            const read = fakeQueryBuilder({ getRawMany: [] })
            const transactions = await build(managerWith(read))

            await expect(transactions.listAccounting("ws-1", 20)).resolves.toEqual([])
            expect(read.callsOf("limit")).toEqual([[20]])
            expect(read.callsOf("leftJoin")).toEqual([
                ["inbound_events", "i", "i.id = t.inbound_event_id AND i.workspace_id = t.workspace_id"],
            ])
        })

        it("carries the input record when the payment still has one", async () => {
            const read = fakeQueryBuilder({
                getRawMany: [
                    {
                        ...raw,
                        inbound_id: "in-1",
                        inbound_channel: "sepay",
                        inbound_event: "evt-1",
                        inbound_body: "DH-20261013-0001",
                        inbound_sender_name: "Minh",
                    },
                ],
            })
            const transactions = await build(managerWith(read))

            const [row] = await transactions.listAccounting("ws-1")
            expect(row?.inbound).toEqual({
                channel: "sepay",
                event_id: "evt-1",
                body: "DH-20261013-0001",
                sender_name: "Minh",
            })
        })
    })
})

describe("TransactionsService", () => {
    describe("open", () => {
        const insertAnswer = { raw: [transactionOf()] }

        it("records an unmatched live payment and answers it in one statement", async () => {
            const write = fakeQueryBuilder({ execute: insertAnswer })
            const manager = managerWith(write)
            const transactions = await build(manager)

            await expect(transactions.open(payment)).resolves.toEqual(transactionOf())
            expect(manager.createQueryBuilder).toHaveBeenCalledWith(TransactionEntity, "t")
            expect(write.callsOf("insert")).toEqual([[]])
            expect(write.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        inboundEventId: "in-1",
                        channel: "bank",
                        amountVnd: 500000,
                        reference: "DH-20261013-0001",
                        payer: "Minh",
                        status: "unmatched",
                        direction: "credit",
                    },
                ],
            ])
            expect(write.callsOf("returning")).toEqual([[RETURNING]])
        })

        it("records a debit when the bank move took money out", async () => {
            const write = fakeQueryBuilder({ execute: insertAnswer })
            const transactions = await build(managerWith(write))

            await transactions.open({ ...payment, payer: "Supplier", direction: "debit" })
            expect(write.callsOf("values")[0]?.[0]).toMatchObject({ payer: "Supplier", direction: "debit" })
        })

        it("records inside the caller transaction when it hands its manager", async () => {
            const em = mockEntityManager()
            const write = fakeQueryBuilder({ execute: insertAnswer })
            const tx = managerWith(write)
            const transactions = await build(em)

            await expect(transactions.open({ ...payment, direction: "debit" }, tx)).resolves.toEqual(transactionOf())
            expect(write.callsOf("values")[0]?.[0]).toMatchObject({ direction: "debit" })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("refuses when no row was created", async () => {
            const transactions = await build(managerWith(fakeQueryBuilder({ execute: { raw: [] } })))

            await expect(transactions.open(payment)).rejects.toMatchObject({
                code: TransactionsErrorCode.NotCreated,
            })
        })
    })
})

describe("TransactionsService", () => {
    describe("match in a caller's transaction", () => {
        it("settles the invoice through the manager it is given", async () => {
            const own = mockEntityManager()
            const callers = mockEntityManager({
                update: [TransactionEntity, { affected: 1, raw: [], generatedMaps: [] }],
            })
            const transactions = await build(own)

            await transactions.match("ws-1", "tx-1", "invoice-1", callers)

            expect(callers.update).toHaveBeenCalledWith(TransactionEntity, PAYMENT_KEY, {
                status: "matched",
                invoiceId: "invoice-1",
            })
            expect(own.update).not.toHaveBeenCalled()
        })
    })

    describe("match and sendToReview", () => {
        it("settles the invoice with the payment and then sends the payment back to review", async () => {
            const em = mockEntityManager({ update: [TransactionEntity, { affected: 1, raw: [], generatedMaps: [] }] })
            const transactions = await build(em)

            await transactions.match("ws-1", "tx-1", "invoice-1")
            await transactions.sendToReview("ws-1", "tx-1")

            expect(em.update.mock.calls).toEqual([
                [TransactionEntity, PAYMENT_KEY, { status: "matched", invoiceId: "invoice-1" }],
                [TransactionEntity, PAYMENT_KEY, { status: "needs_review" }],
            ])
        })
    })
})

describe("TransactionsService", () => {
    describe("listBankCredits", () => {
        it("lists the live bank credits of the workspace with the status, instant and bound given", async () => {
            const credit = {
                id: "tx-1",
                amount_vnd: 500000,
                reference: "HAKUEN F7K2Q9",
                payer: "Minh",
                status: "unmatched",
                occurred_at: "2026-10-20T02:00:00.000000+00:00",
            }
            const read = fakeQueryBuilder({ getRawMany: [credit] })
            const transactions = await build(managerWith(read))

            await expect(
                transactions.listBankCredits({
                    workspaceId: "ws-1",
                    status: "unmatched",
                    since: "2026-10-01T00:00:00.000Z",
                    limit: 20,
                }),
            ).resolves.toEqual([credit])
            expect(read.callsOf("select")[0]?.[0]).toContain(TEXT_OCCURRED)
            expect(read.callsOf("where")).toEqual([
                [
                    "t.workspace_id = :workspaceId AND t.channel = 'bank' AND t.direction = :direction",
                    { workspaceId: "ws-1", direction: "credit" },
                ],
            ])
            expect(read.callsOf("andWhere")).toEqual([
                ["t.status = :status", { status: "unmatched" }],
                ["t.occurred_at >= :since", { since: new Date("2026-10-01T00:00:00.000Z") }],
            ])
            expect(read.callsOf("orderBy")).toEqual([["t.occurred_at", "DESC"]])
            expect(read.callsOf("addOrderBy")).toEqual([["t.id", "DESC"]])
            expect(read.callsOf("limit")).toEqual([[20]])
        })
    })
})

describe("TransactionsService", () => {
    describe("listBankDebits", () => {
        it("lists the live bank debits of the workspace with the same filters", async () => {
            const read = fakeQueryBuilder({ getRawMany: [] })
            const transactions = await build(managerWith(read))

            await expect(
                transactions.listBankDebits({ workspaceId: "ws-1", status: null, since: null, limit: 5 }),
            ).resolves.toEqual([])
            expect(read.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", direction: "debit" })
            expect(read.callsOf("andWhere")).toEqual([])
            expect(read.callsOf("limit")).toEqual([[5]])
        })
    })
})
