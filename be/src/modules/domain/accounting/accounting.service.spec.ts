import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { DecisionsService } from "@modules/domain/decisions"
import { StaffService } from "@modules/domain/staff"
import type { StaffRow } from "@modules/domain/staff"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import type { AccountingBook } from "./accounting-book.contracts"
import { AccountingBookService } from "./accounting-book.service"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingService } from "./accounting.service"

const WORKSPACE = "ws-1"
const USER = "user-1"
const NOW = "2026-10-12T10:00:00.000Z"

const EMPTY_BOOK: AccountingBook = {
    invoices: [],
    transactions: [],
    orders: [],
    works: [],
    decisions: [],
    adjustments: [],
    payables: [],
    adjustmentsReady: true,
}

const fact = (attribute: string, value: string): FactRecord =>
    mock<FactRecord>({ subjectKey: "tax_profile", attribute, value })

const STAFF: StaffRow = {
    id: "s-1",
    workspace_id: WORKSPACE,
    name: "Hoa",
    role: "cashier",
    email: null,
    active: true,
    created_at: "2026-10-01T00:00:00Z",
}

const memberOf = (role: WorkspaceRole): WorkspaceMember => ({
    userId: USER,
    workspaceId: WORKSPACE,
    role,
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const build = async (role: WorkspaceRole = "owner", facts: ReadonlyArray<FactRecord> = []) => {
    const books = mock<AccountingBookService>({ read: jest.fn(() => Promise.resolve(EMPTY_BOOK)) })
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf(role))) })
    const decisions = mock<DecisionsService>({ listAccountingWaiting: jest.fn(() => Promise.resolve([])) })
    const staff = mock<StaffService>({ list: jest.fn(() => Promise.resolve([STAFF])) })
    const gateway = mock<AccountingGateway>({
        creditsSource: jest.fn(() => Promise.resolve("SePay")),
        payablesSource: jest.fn(() => Promise.resolve("Viettel S-Invoice")),
    })
    const brain = mock<BrainFactsService>({ list: jest.fn(() => Promise.resolve(facts)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingService,
            { provide: AccountingBookService, useValue: books },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DecisionsService, useValue: decisions },
            { provide: StaffService, useValue: staff },
            { provide: BrainFactsService, useValue: brain },
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(AccountingService), books, members, gateway, brain }
}

const registerPayables = () => {
    it("names the invoice connector and has no upcoming dues while the Brain holds no tax profile", async () => {
        const { service } = await build()

        await expect(service.workbench(USER, WORKSPACE)).resolves.toMatchObject({
            payablesSource: "Viettel S-Invoice",
            upcoming: null,
            reminderDays: null,
        })
    })

    it("lists the dues of the tax profile from stored rows and reads no payable tool", async () => {
        const { service, gateway, brain } = await build("owner", [
            fact("tax_code", "0100109106"),
            fact("reminder_days", "5"),
        ])

        const workbench = await service.workbench(USER, WORKSPACE)

        expect(brain.list).toHaveBeenCalledWith(WORKSPACE, { statuses: ["active"] })
        expect(workbench.reminderDays).toBe(5)
        expect(workbench.upcoming?.length).toBeGreaterThan(0)
        expect(gateway.listOpenPayables).not.toHaveBeenCalled()
        expect(gateway.listPaymentDebits).not.toHaveBeenCalled()
    })
}

describe("AccountingService", () => {
    describe("payables", registerPayables)

    describe("book", () => {
        it("answers the raw book of the workspace to a member", async () => {
            const { service, members } = await build()

            const book = await service.book(USER, WORKSPACE)

            expect(book).toMatchObject({ invoices: [], transactions: [], orders: [], adjustments: [] })
            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE)
        })

        it("reads nothing for someone who is not a member", async () => {
            const { service, members, books } = await build()
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(service.book(USER, WORKSPACE)).rejects.toBe(refusal)
            expect(books.read).not.toHaveBeenCalled()
        })
    })

    describe("workbench", () => {
        it("derives the workbench at the clock's instant with the member's name and the staff choices", async () => {
            const { service } = await build("manager")

            const workbench = await service.workbench(USER, WORKSPACE)

            expect(workbench).toMatchObject({
                now: NOW,
                ownerName: "Lan",
                canAdjust: true,
                adjustmentsReady: true,
                creditsSource: "SePay",
                questions: [],
                ledger: [],
                excludedTest: 0,
                staff: [
                    {
                        id: "s-1",
                        workspaceId: WORKSPACE,
                        name: "Hoa",
                        role: "cashier",
                        email: null,
                        active: true,
                        createdAt: "2026-10-01T00:00:00Z",
                    },
                ],
            })
        })

        it("does not let staff correct the books", async () => {
            const { service } = await build("staff")

            await expect(service.workbench(USER, WORKSPACE)).resolves.toMatchObject({ canAdjust: false })
        })
    })

    describe("ledger", () => {
        it("answers the ledger of the workbench", async () => {
            const { service } = await build()

            await expect(service.ledger(USER, WORKSPACE)).resolves.toEqual([])
        })
    })
})
