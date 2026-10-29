import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AccountingAdjustmentsService } from "./accounting-adjustments.service"
import { AccountingAdjustmentsErrorCode } from "./errors/accounting-adjustments.error"
import type { AccountingAdjustmentRow } from "./accounting-adjustments.contracts"
import { AccountingAdjustmentEntity } from "./persistence/entities"

const WORKSPACE = "ws-1"
const USER = "user-1"
const TARGET = "0f8fad5b-d9cb-469f-a165-70867728950e"

const MEMBER: WorkspaceMember = {
    userId: USER,
    workspaceId: WORKSPACE,
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const adjustmentOf = builder<AccountingAdjustmentRow>({
    id: "adj-1",
    target_type: "invoice",
    target_id: TARGET,
    note: "Customer paid less",
    corrected_amount_vnd: 90000,
    created_by: "Lan",
    created_at: "2026-10-12T10:00:00.000Z",
})

const entityOf = builder<AccountingAdjustmentEntity>({
    id: "adj-1",
    workspaceId: WORKSPACE,
    targetType: "invoice",
    targetId: TARGET,
    note: "Customer paid less",
    correctedAmountVnd: "90000",
    createdBy: "Lan",
    createdByUser: null,
    createdAt: new Date("2026-10-12T10:00:00Z"),
})

const invoiceOf = builder<InvoiceRow>({
    id: TARGET,
    workspace_id: WORKSPACE,
    order_id: null,
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 100000,
    status: "issued",
    issued_by: null,
    paid_at: null,
    contract_id: null,
    period_ends_on: null,
})

const build = async (entityManager: MockEntityManager) => {
    const tx = fakeTransaction(entityManager)
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(MEMBER)) })
    const invoices = mock<InvoicesService>({ find: jest.fn(() => Promise.resolve(invoiceOf())) })
    const transactions = mock<TransactionsService>({ find: jest.fn(() => Promise.resolve(null)) })
    const events = mock<EventsService>({ record: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingAdjustmentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InvoicesService, useValue: invoices },
            { provide: TransactionsService, useValue: transactions },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(AccountingAdjustmentsService), tx, members, invoices, transactions, events }
}

describe("AccountingAdjustmentsService", () => {
    describe("history", () => {
        it("answers the corrections of the workspace as ready", async () => {
            const { service } = await build(mockEntityManager({ find: [AccountingAdjustmentEntity, [entityOf()]] }))

            await expect(service.history(WORKSPACE)).resolves.toEqual({ items: [adjustmentOf()], ready: true })
        })

        it("answers an empty, not ready history while the correction table is not migrated", async () => {
            const em = mockEntityManager({ find: [AccountingAdjustmentEntity, []] })
            em.find.mockRejectedValueOnce({ driverError: { code: "42P01" } })
            const { service } = await build(em)

            await expect(service.history(WORKSPACE)).resolves.toEqual({ items: [], ready: false })
        })

        it("lets any other database failure through", async () => {
            const em = mockEntityManager({ find: [AccountingAdjustmentEntity, []] })
            const failure = new Error("connection reset")
            em.find.mockRejectedValueOnce(failure)
            const { service } = await build(em)

            await expect(service.history(WORKSPACE)).rejects.toBe(failure)
        })

        it.each([null, "connection reset", { code: "23505" }, { driverError: null }])(
            "preserves a non-migration database failure: %p",
            async (failure) => {
                const em = mockEntityManager({ find: [AccountingAdjustmentEntity, []] })
                em.find.mockRejectedValueOnce(failure)
                const { service } = await build(em)

                await expect(service.history(WORKSPACE)).rejects.toBe(failure)
                expect(em.find).toHaveBeenCalledWith(AccountingAdjustmentEntity, {
                    where: { workspaceId: WORKSPACE },
                    order: { createdAt: "DESC", id: "DESC" },
                    take: 500,
                })
            },
        )

        it("recognizes PostgreSQL's missing-table code directly", async () => {
            const em = mockEntityManager({ find: [AccountingAdjustmentEntity, []] })
            em.find.mockRejectedValueOnce({ code: "42P01" })
            const { service } = await build(em)

            await expect(service.history(WORKSPACE)).resolves.toEqual({ items: [], ready: false })
            expect(em.find).toHaveBeenCalledWith(AccountingAdjustmentEntity, {
                where: { workspaceId: WORKSPACE },
                order: { createdAt: "DESC", id: "DESC" },
                take: 500,
            })
        })
    })
})

const createdRow = (overrides: Record<string, unknown> = {}) => ({
    id: "adj-1",
    target_type: "invoice",
    target_id: TARGET,
    note: "Customer paid less",
    corrected_amount_vnd: "90000",
    created_by: "Lan",
    created_at: new Date("2026-10-12T10:00:00Z"),
    ...overrides,
})

/** A manager whose appending statement answers `raw`. */
const appending = (raw: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder({ execute: { raw } })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("AccountingAdjustmentsService", () => {
    describe("create", () => {
        it("appends the correction and its evidence line in one transaction under the member's name", async () => {
            const { em, fake } = appending([createdRow()])
            const { service, tx, members, events } = await build(em)

            const created = await service.create(USER, WORKSPACE, {
                targetType: "invoice",
                targetId: TARGET,
                note: "  Customer   paid less ",
                correctedAmount: 90000.4,
            })

            expect(created).toEqual(adjustmentOf())
            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
            expect(tx.commits).toBe(1)
            expect(em.createQueryBuilder).toHaveBeenCalledWith(AccountingAdjustmentEntity, "aa")
            expect(fake.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: WORKSPACE,
                        targetType: "invoice",
                        targetId: TARGET,
                        note: "Customer paid less",
                        correctedAmountVnd: "90000",
                        createdBy: "Lan",
                    },
                ],
            ])
            expect(fake.callsOf("returning")).toEqual([[expect.stringContaining("created_at")]])
            expect(events.record.mock.calls[0]?.[0]).toEqual({
                workspaceId: WORKSPACE,
                leadId: "lead-1",
                kind: "accounting.adjustment",
                actor: "Lan",
                summary: "Customer paid less (90000 VND)",
                evidence: "Customer paid less",
            })
        })

        it("refuses a target that is not in the workspace and writes nothing", async () => {
            const { service, tx } = await build(mockEntityManager())

            await expect(
                service.create(USER, WORKSPACE, { targetType: "transaction", targetId: TARGET, note: "Wrong payer" }),
            ).rejects.toMatchObject({ code: AccountingAdjustmentsErrorCode.NotFound })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses a note that is too short", async () => {
            const { service } = await build(mockEntityManager())

            await expect(
                service.create(USER, WORKSPACE, { targetType: "invoice", targetId: TARGET, note: "no" }),
            ).rejects.toMatchObject({ code: AccountingAdjustmentsErrorCode.Invalid })
        })
    })
})

describe("AccountingAdjustmentsService", () => {
    describe("create", () => {
        it("rolls back when the insert answers no row", async () => {
            const { em } = appending([])
            const { service, tx, events } = await build(em)

            await expect(
                service.create(USER, WORKSPACE, { targetType: "invoice", targetId: TARGET, note: "Note only fix" }),
            ).rejects.toMatchObject({ code: AccountingAdjustmentsErrorCode.NotCreated })
            expect(tx.rollbacks).toBe(1)
            expect(events.record).not.toHaveBeenCalled()
        })

        it("rolls back when the insert fails", async () => {
            const em = mockEntityManager()
            const failure = fakeQueryBuilder({ execute: () => Promise.reject(new Error("insert failed")) })
            em.createQueryBuilder.mockReturnValue(failure.builder)
            const { service, tx, events } = await build(em)

            await expect(
                service.create(USER, WORKSPACE, { targetType: "invoice", targetId: TARGET, note: "Note only fix" }),
            ).rejects.toThrow("insert failed")
            expect(tx.rollbacks).toBe(1)
            expect(events.record).not.toHaveBeenCalled()
        })
    })
})
