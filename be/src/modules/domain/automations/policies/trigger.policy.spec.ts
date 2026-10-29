import { Test } from "@nestjs/testing"
import { buildShop } from "@tests/fixtures/builders/automations.builder"
import {
    DAY_MS,
    eventDataOf as realEventDataOf,
    planTrigger as realPlanTrigger,
    textOf as realTextOf,
} from "./trigger.policy"
import type { TriggerInput } from "./trigger.policy"

const SUBJECT = Symbol("trigger.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    eventDataOf: realEventDataOf,
                    textOf: realTextOf,
                    planTrigger: realPlanTrigger,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        eventDataOf: typeof realEventDataOf
        textOf: typeof realTextOf
        planTrigger: typeof realPlanTrigger
    }>(SUBJECT)
}

const AT = new Date("2026-10-12T15:00:00.000Z")

const input = (overrides: Partial<TriggerInput>): TriggerInput => ({
    templateKey: "thank_payment",
    event: "payment.received",
    data: { invoice_id: "i-1", lead_id: "l-1" },
    dedupe: "d-1",
    config: {},
    at: AT,
    shop: buildShop(),
    ...overrides,
})

describe("textOf and eventDataOf", () => {
    it("reads a text, a number and a switch as text and anything else as nothing", async () => {
        const subject = await buildSubject()

        expect(subject.textOf("a")).toBe("a")
        expect(subject.textOf(3)).toBe("3")
        expect(subject.textOf(true)).toBe("true")
        expect(subject.textOf({})).toBe("")
        expect(subject.textOf(undefined)).toBe("")
    })

    it("copies what an event carries", async () => {
        const subject = await buildSubject()

        const data = { a: 1 }

        expect(subject.eventDataOf(data)).toEqual(data)
        expect(subject.eventDataOf(data)).not.toBe(data)
    })
})

describe("planTrigger", () => {
    it("starts the thank-you right behind a payment, waiting for the built-in care message", async () => {
        const subject = await buildSubject()

        expect(subject.planTrigger(input({}))).toEqual({
            dedupe: "thank:d-1",
            triggerRef: "i-1",
            payload: { invoice_id: "i-1", lead_id: "l-1", at: AT.toISOString() },
            delayMs: 90_000,
        })
    })

    it("asks for a review after the configured days, one day by default", async () => {
        const subject = await buildSubject()

        const base = { templateKey: "ask_review" }

        expect(subject.planTrigger(input({ ...base, config: { afterDays: 3 } }))).toMatchObject({
            dedupe: "review:d-1",
            triggerRef: "l-1",
            delayMs: 3 * DAY_MS,
        })
        expect(subject.planTrigger(input({ ...base }))).toMatchObject({ delayMs: DAY_MS })
    })

    it("tells the customer a shipped order is on its way", async () => {
        const subject = await buildSubject()

        expect(
            subject.planTrigger(
                input({ templateKey: "delivery_notice", event: "order.shipped", data: { order_id: "o-1" } }),
            ),
        ).toEqual({ dedupe: "ship:d-1", triggerRef: "o-1", payload: { order_id: "o-1" }, delayMs: 0 })
    })

    it("reminds about a contract that is expiring", async () => {
        const subject = await buildSubject()

        expect(
            subject.planTrigger(
                input({ templateKey: "contract_renewal", event: "contract.expiring", data: { contract_id: "c-1" } }),
            ),
        ).toMatchObject({ dedupe: "renew:d-1", triggerRef: "c-1" })
    })

    it("records the rows of the spreadsheet events by order number, else by lead", async () => {
        const subject = await buildSubject()

        const sheet = { templateKey: "sheet_orders" }

        expect(
            subject.planTrigger(input({ ...sheet, event: "order.confirmed", data: { order_no: "DH1" } })),
        ).toMatchObject({
            dedupe: "sheet:d-1",
            triggerRef: "DH1",
            payload: { event: "order.confirmed", data: { order_no: "DH1" }, at: AT.toISOString() },
        })
        expect(subject.planTrigger(input({ ...sheet, event: "lead.created", data: { lead_id: "l-9" } }))).toMatchObject(
            {
                triggerRef: "l-9",
            },
        )
        expect(subject.planTrigger(input({ ...sheet, event: "message.inbound" }))).toBeNull()
    })
})

describe("planTrigger", () => {
    it("does nothing for an event or a template it does not know", async () => {
        const subject = await buildSubject()

        expect(subject.planTrigger(input({ event: "lead.created" }))).toBeNull()
        expect(subject.planTrigger(input({ templateKey: "unknown" }))).toBeNull()
    })
})
