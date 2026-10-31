import { Test } from "@nestjs/testing"
import { PAYABLE_PROFILE as PROFILE, paidPayableRow, payableRow } from "../../../tests/fixtures/builders/supplier-payables.builder"
import { upcomingOf } from "./accounting-upcoming.policy"

const SUBJECT = Symbol("accounting-upcoming.policy")

const TODAY = "2026-10-15"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { upcomingOf } }],
    }).compile()
    return moduleRef.get<{ upcomingOf: typeof upcomingOf }>(SUBJECT)
}

describe("accounting-upcoming.policy", () => {
    it("has no list when the Brain holds no tax profile", async () => {
        const subject = await build()

        expect(subject.upcomingOf(null, [payableRow({ dueOn: "2026-10-20" })], TODAY)).toBeNull()
    })

    it("merges the tax deadlines with the open supplier invoices from the stored rows", async () => {
        const subject = await build()

        const dues = subject.upcomingOf(PROFILE, [payableRow({ dueOn: "2026-10-20" })], TODAY) ?? []

        expect(dues.filter((due) => due.source === "supplier")).toEqual([
            {
                source: "supplier",
                kind: "supplier_payment",
                ref: "17",
                dueOn: "2026-10-20",
                daysLeft: 5,
                amountVnd: 4_620_000,
                note: "Linh An",
            },
        ])
        expect(dues.filter((due) => due.source === "tax").length).toBeGreaterThan(0)
    })

    it("leaves a paid invoice out and lists the tax deadlines alone when no invoice is stored", async () => {
        const subject = await build()

        const dues = subject.upcomingOf(PROFILE, [paidPayableRow({ dueOn: "2026-10-20" })], TODAY) ?? []

        expect(dues.length).toBeGreaterThan(0)
        expect(dues.every((due) => due.source === "tax")).toBe(true)
    })

    it("lists an overdue invoice with negative days left", async () => {
        const subject = await build()

        const dues = subject.upcomingOf(PROFILE, [payableRow({ dueOn: "2026-10-10" })], TODAY) ?? []

        expect(dues.find((due) => due.source === "supplier")).toMatchObject({ dueOn: "2026-10-10", daysLeft: -5 })
    })
})
