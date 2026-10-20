import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import type { HubCardPayload } from "./accounting-desk.contracts"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, GatewayBankCredit } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { DeskDailyService, vnDayOf } from "./desk-daily.service"
import { EinvoiceReviewService } from "./einvoice-review.service"
import { FolioReconcileService } from "./folio-reconcile.service"
import { kindText } from "./messages/accounting-desk.messages"

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

const credit = (bankTxnRef: string, matched: boolean): GatewayBankCredit => ({
    bankTxnRef,
    content: "CK HAKUEN F7K2Q9",
    amountVnd: 12_800_000,
    occurredAt: "2026-10-19T20:00:00Z",
    matched,
})

const build = async (facts: ReadonlyArray<FactRecord> = PROFILE_FACTS) => {
    const brain = mock<BrainFactsService>({ list: jest.fn(() => Promise.resolve(facts)) })
    const installations = mock<InstallationRecordsService>({
        workspacesOf: jest.fn(() => Promise.resolve([WS, "ws-2"])),
    })
    const gateway = mock<AccountingGateway>({
        listBankCredits: jest.fn(() =>
            Promise.resolve([credit("SP-1", true), credit("SP-2", false), credit("SP-3", false)]),
        ),
        listOpenPayables: jest.fn(() =>
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
        review: jest.fn(() => Promise.resolve({ valid: 38, needsReview: 3, invalidTaxCode: 1 })),
    })
    const folios = mock<FolioReconcileService>({
        reconcile: jest
            .fn()
            .mockResolvedValueOnce({ kind: "recorded" })
            .mockResolvedValueOnce({ kind: "mismatch", match: "partial" }),
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
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: EinvoiceReviewService, useValue: review },
            { provide: FolioReconcileService, useValue: folios },
            { provide: AccountingRoomService, useValue: room },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { daily: moduleRef.get(DeskDailyService), brain, review, folios, room }
}

describe("DeskDailyService", () => {
    it("takes the calendar day in Vietnam", () => {
        expect(vnDayOf(new Date("2026-10-19T17:00:00Z"))).toBe("2026-10-20")
        expect(vnDayOf(new Date("2026-10-19T16:59:59Z"))).toBe("2026-10-19")
    })

    it("checks the invoices, matches the open credits, posts the card and the reminders due today", async () => {
        const { daily, brain, review, folios, room } = await build()

        const outcome = await daily.run(WS)

        expect(brain.list).toHaveBeenCalledWith(WS, { statuses: ["active"] })
        expect(review.review).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ taxCode: "0108896128", reminderDays: 10 }),
            [{ name: "linh-an", taxCode: "0100109106", termDays: 7 }],
            new Date("2026-10-18T23:30:00Z"),
        )
        expect(folios.reconcile).toHaveBeenCalledTimes(2)
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

    it("skips a workspace without a tax profile and runs every workspace with the accounting module", async () => {
        const quiet = await build([])

        await expect(quiet.daily.run(WS)).resolves.toEqual({ card: null, reminders: 0 })
        await expect(quiet.daily.runAll()).resolves.toBe(2)
        expect(quiet.brain.list).toHaveBeenCalledWith("ws-2", { statuses: ["active"] })
        expect(quiet.review.review).not.toHaveBeenCalled()
    })
})
