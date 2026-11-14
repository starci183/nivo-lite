import { SdkDefinitionError } from "../block/definition-error"
import { defineWebhookEvent } from "./webhook"

const LABEL = { vi: "\u0110\u01a1n h\u00e0ng \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn", en: "An order is confirmed" }

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("defineWebhookEvent", () => {
    it("returns the declaration with its discriminant, keeping every field", () => {
        const event = defineWebhookEvent({ id: "order.confirmed", label: LABEL, moduleKey: "sales", sample: { orderNo: "DH-1" } })
        expect(event).toEqual({ entry: "webhook-event", id: "order.confirmed", label: LABEL, moduleKey: "sales", sample: { orderNo: "DH-1" } })
    })

    it("accepts a summary and kebab-case parts", () => {
        const summary = { vi: "Khi \u0111\u01a1n \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn", en: "When an order is confirmed" }
        expect(defineWebhookEvent({ id: "lead-gen.sign-up", label: LABEL, summary, moduleKey: "lead-gen" }).summary).toBe(summary)
    })

    it.each(["order", "order.confirmed.now", "Order.confirmed", "order.", ".confirmed", "order confirmed", "1order.confirmed"])(
        "refuses the id %s",
        (id) => {
            const error = captured(() => defineWebhookEvent({ id, label: LABEL, moduleKey: "sales" }))
            expect(error).toBeInstanceOf(SdkDefinitionError)
            expect(error).toMatchObject({ code: "ID_MALFORMED", params: { at: id } })
        },
    )

    it("refuses a module key that is no kebab-case key", () => {
        expect(captured(() => defineWebhookEvent({ id: "order.confirmed", label: LABEL, moduleKey: "Sales" }))).toMatchObject({
            code: "ID_MALFORMED",
        })
    })

    it("refuses a label with an empty language", () => {
        expect(
            captured(() => defineWebhookEvent({ id: "order.confirmed", label: { vi: "", en: "x" }, moduleKey: "sales" })),
        ).toMatchObject({ code: "ID_MALFORMED", params: { at: "order.confirmed.label" } })
    })
})
