import { buildShop } from "@tests/fixtures/builders/automations.builder"
import { DAY_MS, eventDataOf, planTrigger, textOf } from "./trigger.policy"
import type { TriggerInput } from "./trigger.policy"

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
    it("reads a text, a number and a switch as text and anything else as nothing", () => {
        expect(textOf("a")).toBe("a")
        expect(textOf(3)).toBe("3")
        expect(textOf(true)).toBe("true")
        expect(textOf({})).toBe("")
        expect(textOf(undefined)).toBe("")
    })

    it("copies what an event carries", () => {
        const data = { a: 1 }

        expect(eventDataOf(data)).toEqual(data)
        expect(eventDataOf(data)).not.toBe(data)
    })
})

describe("planTrigger", () => {
    it("starts the thank-you right behind a payment, waiting for the built-in care message", () => {
        expect(planTrigger(input({}))).toEqual({
            dedupe: "thank:d-1",
            triggerRef: "i-1",
            payload: { invoice_id: "i-1", lead_id: "l-1", at: AT.toISOString() },
            delayMs: 90_000,
        })
    })

    it("asks for a review after the configured days, one day by default", () => {
        const base = { templateKey: "ask_review" }

        expect(planTrigger(input({ ...base, config: { afterDays: 3 } }))).toMatchObject({
            dedupe: "review:d-1",
            triggerRef: "l-1",
            delayMs: 3 * DAY_MS,
        })
        expect(planTrigger(input({ ...base }))).toMatchObject({ delayMs: DAY_MS })
    })

    it("tells the customer a shipped order is on its way", () => {
        expect(
            planTrigger(input({ templateKey: "delivery_notice", event: "order.shipped", data: { order_id: "o-1" } })),
        ).toEqual({ dedupe: "ship:d-1", triggerRef: "o-1", payload: { order_id: "o-1" }, delayMs: 0 })
    })

    it("reminds about a contract that is expiring", () => {
        expect(
            planTrigger(
                input({ templateKey: "contract_renewal", event: "contract.expiring", data: { contract_id: "c-1" } }),
            ),
        ).toMatchObject({ dedupe: "renew:d-1", triggerRef: "c-1" })
    })

    it("records the rows of the spreadsheet events by order number, else by lead", () => {
        const sheet = { templateKey: "sheet_orders" }

        expect(planTrigger(input({ ...sheet, event: "order.confirmed", data: { order_no: "DH1" } }))).toMatchObject({
            dedupe: "sheet:d-1",
            triggerRef: "DH1",
            payload: { event: "order.confirmed", data: { order_no: "DH1" }, at: AT.toISOString() },
        })
        expect(planTrigger(input({ ...sheet, event: "lead.created", data: { lead_id: "l-9" } }))).toMatchObject({
            triggerRef: "l-9",
        })
        expect(planTrigger(input({ ...sheet, event: "message.inbound" }))).toBeNull()
    })

    describe("after hours", () => {
        const base = { templateKey: "after_hours", event: "message.inbound", data: { conversation_id: "cv-1" } }

        it("answers a message that arrives outside the opening hours, once a day per conversation", () => {
            expect(planTrigger(input({ ...base }))).toEqual({
                dedupe: "after:cv-1:2026-10-12",
                triggerRef: "cv-1",
                payload: { conversation_id: "cv-1", dedupe: "d-1" },
                delayMs: 0,
            })
        })

        it("stays quiet during the opening hours", () => {
            expect(planTrigger(input({ ...base, at: new Date("2026-10-12T03:00:00.000Z") }))).toBeNull()
        })

        it("reads the hours from the settings when the shop states none", () => {
            const shop = buildShop({ hoursRange: null })
            const config = { openFrom: "08:00", openTo: "21:00" }

            expect(planTrigger(input({ ...base, shop, config, at: new Date("2026-10-12T03:00:00.000Z") }))).toBeNull()
            expect(planTrigger(input({ ...base, shop, config }))).not.toBeNull()
        })
    })

    it("does nothing for an event or a template it does not know", () => {
        expect(planTrigger(input({ event: "lead.created" }))).toBeNull()
        expect(planTrigger(input({ templateKey: "unknown" }))).toBeNull()
    })
})
