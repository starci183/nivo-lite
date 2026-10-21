import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord, InstallationStatus } from "@modules/domain/module-installations"
import { ModuleReadinessService } from "@modules/domain/modules"
import { CLOCK } from "@modules/platform/clock"
import type { DeskConnections, HubCardPayload } from "./accounting-desk.contracts"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, PaymentCredit } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { DeskDailyService, vnDayOf } from "./desk-daily.service"
import { EinvoiceReviewService } from "./einvoice-review.service"
import { CARD_COPY, kindText } from "./messages/accounting-desk.messages"
import { ReceivableReconcileService } from "./receivable-reconcile.service"
import { SupplierPaymentsService } from "./supplier-payments.service"

const WS = "ws-1"

const fact = (subjectKey: string, attribute: string, value: string): FactRecord =>
    mock<FactRecord>({ subjectKey, attribute, value })

const PROFILE_FACTS = [
    fact("tax_profile", "tax_code", "0108896128"),
    fact("tax_profile", "withholds_pit", "false"),
    fact("tax_profile", "established_year", "2019"),
    fact("tax_profile", "reminder_days", "10"),
    fact("supplier:linh-an", "tax_code", "0100109106"),
    fact("supplier:linh-an", "term_days", "7"),
]

const credit = (creditRef: string, matched: boolean): PaymentCredit => ({
    creditRef,
    reference: "CK PAY F7K2Q9",
    amountVnd: 12_800_000,
    occurredAt: "2026-10-19T20:00:00Z",
    matched,
})

interface BuildOptions {
    /** The Second Brain facts of the workspace. */
    readonly facts?: ReadonlyArray<FactRecord>
    /** The installation of the accounting module, or null when it is not installed. */
    readonly installation?: InstallationRecord | null
    /** The status the run guard settles the installation in. */
    readonly status?: InstallationStatus
    /** The optional features the workspace has tools for. */
    readonly connected?: DeskConnections
}

const INSTALLATION = mock<InstallationRecord>({ id: "inst-1", workspaceId: WS, moduleKey: "accounting" })

const build = async ({
    facts = PROFILE_FACTS,
    installation = INSTALLATION,
    status = "live",
    connected = { invoices: true, receivables: true },
}: BuildOptions = {}) => {
    const brain = mock<BrainFactsService>({ list: jest.fn(() => Promise.resolve(facts)) })
    const installations = mock<InstallationRecordsService>({
        workspacesOf: jest.fn(() => Promise.resolve([WS, "ws-2"])),
        firstOfModule: jest.fn(() => Promise.resolve(installation)),
    })
    const readiness = mock<ModuleReadinessService>({ settle: jest.fn(() => Promise.resolve(status)) })
    const gateway = mock<AccountingGateway>({
        connections: jest.fn(() => Promise.resolve(connected)),
        listPaymentCredits: jest.fn(() =>
            Promise.resolve({
                tool: "bank.transactions.list",
                value: [credit("SP-1", true), credit("SP-2", false), credit("SP-3", false)],
            }),
        ),
    })
    const supplierPayments = mock<SupplierPaymentsService>({
        openPayables: jest.fn(() =>
            Promise.resolve([
                {
                    supplier: "Linh An",
                    sellerTaxCode: "0100109106",
                    invoiceNo: "17",
                    amountVnd: 4_620_000,
                    issuedOn: "2026-10-19",
                },
            ]),
        ),
    })
    const review = mock<EinvoiceReviewService>({
        review: jest.fn(() =>
            Promise.resolve({ valid: 38, needsReview: 3, invalidTaxCode: 1, tool: "inbox.invoices.list" }),
        ),
    })
    const receivables = mock<ReceivableReconcileService>({
        reconcile: jest
            .fn()
            .mockResolvedValueOnce({ kind: "no_reference", tool: null })
            .mockResolvedValueOnce({ kind: "recorded", tool: "billing.receivables.find" }),
    })
    const room = mock<AccountingRoomService>({
        post: jest.fn(() => Promise.resolve()),
        postCard: jest.fn((_workspaceId: string, card: HubCardPayload) => Promise.resolve(card)),
    })
    // 06:30 in Vietnam on 20/10.
    const clock = new FakeClock("2026-10-19T23:30:00Z")
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeskDailyService,
            { provide: BrainFactsService, useValue: brain },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModuleReadinessService, useValue: readiness },
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: EinvoiceReviewService, useValue: review },
            { provide: ReceivableReconcileService, useValue: receivables },
            { provide: SupplierPaymentsService, useValue: supplierPayments },
            { provide: AccountingRoomService, useValue: room },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { daily: moduleRef.get(DeskDailyService), brain, readiness, gateway, review, receivables, room }
}

describe("DeskDailyService", () => {
    it("takes the calendar day in Vietnam", () => {
        expect(vnDayOf(new Date("2026-10-19T17:00:00Z"))).toBe("2026-10-20")
        expect(vnDayOf(new Date("2026-10-19T16:59:59Z"))).toBe("2026-10-19")
    })

    it("settles the installation, checks the invoices, matches the open credits, posts the card and the reminders due today", async () => {
        const { daily, brain, readiness, review, receivables, room } = await build()

        const outcome = await daily.run(WS)

        expect(readiness.settle).toHaveBeenCalledWith(WS, "inst-1")
        expect(brain.list).toHaveBeenCalledWith(WS, { statuses: ["active"] })
        expect(review.review).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ taxCode: "0108896128", reminderDays: 10 }),
            [{ name: "linh-an", taxCode: "0100109106", termDays: 7 }],
            new Date("2026-10-18T23:30:00Z"),
        )
        expect(receivables.reconcile).toHaveBeenCalledTimes(2)
        expect(receivables.reconcile).toHaveBeenCalledWith(WS, credit("SP-2", false), "bank.transactions.list")
        expect(outcome.status).toBe("ran")
        expect(outcome.card?.hub.sources?.map((source) => source.ref)).toEqual([
            "inbox.invoices.list",
            "bank.transactions.list",
            "billing.receivables.find",
            "tax_profile",
            "tax-calendar-vn",
        ])
        expect(outcome.card).toEqual(
            expect.objectContaining({
                day: "2026-10-20",
                stats: { valid: 38, needsReview: 3, invalidTaxCode: 1 },
                bank: { matched: 2, unmatched: 1 },
            }),
        )
        expect(outcome.card?.next).toEqual(
            expect.objectContaining({ kind: "supplier_payment", dueOn: "2026-10-26", daysLeft: 6 }),
        )
        expect(room.postCard).toHaveBeenCalledWith(WS, outcome.card?.hub, outcome.card?.text)
        expect(outcome.reminders).toBe(1)
        expect(room.post).toHaveBeenCalledWith(WS, expect.stringContaining(kindText("cit_provisional")))
    })
})

describe("DeskDailyService run guard and optional roles", () => {
    it("says a feature without its role is not connected and does not run it", async () => {
        const { daily, review, receivables } = await build({ connected: { invoices: false, receivables: false } })

        const outcome = await daily.run(WS)

        expect(review.review).not.toHaveBeenCalled()
        expect(receivables.reconcile).not.toHaveBeenCalled()
        expect(outcome.card?.stats).toEqual({ valid: 0, needsReview: 0, invalidTaxCode: 0 })
        expect(outcome.card?.hub.lines?.slice(0, 2)).toEqual([
            { text: CARD_COPY.notConnected(CARD_COPY.sourceInvoices) },
            { text: CARD_COPY.notConnected(CARD_COPY.sourceReceivables) },
        ])
        expect(outcome.card?.hub.sources?.map((source) => source.ref)).toEqual([
            "bank.transactions.list",
            "tax_profile",
            "tax-calendar-vn",
        ])
    })

    it.each([
        { status: "needs_connection" as const, expected: "needs_connection" },
        { status: "setup" as const, expected: "not_running" },
        { status: "paused" as const, expected: "not_running" },
    ])("does not run while the installation is $status", async ({ status, expected }) => {
        const { daily, brain, gateway, room } = await build({ status })

        await expect(daily.run(WS)).resolves.toEqual({ status: expected, card: null, reminders: 0 })
        expect(brain.list).not.toHaveBeenCalled()
        expect(gateway.listPaymentCredits).not.toHaveBeenCalled()
        expect(room.postCard).not.toHaveBeenCalled()
    })

    it("runs a ready installation and refuses a workspace without the accounting module", async () => {
        const ready = await build({ status: "ready" })
        await expect(ready.daily.run(WS)).resolves.toMatchObject({ status: "ran" })

        const missing = await build({ installation: null })
        await expect(missing.daily.run(WS)).resolves.toEqual({ status: "not_installed", card: null, reminders: 0 })
        expect(missing.readiness.settle).not.toHaveBeenCalled()
    })

    it("skips a workspace without a tax profile and runs every workspace with the accounting module", async () => {
        const quiet = await build({ facts: [] })

        await expect(quiet.daily.run(WS)).resolves.toEqual({ status: "no_tax_profile", card: null, reminders: 0 })
        await expect(quiet.daily.runAll()).resolves.toBe(2)
        expect(quiet.brain.list).toHaveBeenCalledWith("ws-2", { statuses: ["active"] })
        expect(quiet.review.review).not.toHaveBeenCalled()
    })
})
