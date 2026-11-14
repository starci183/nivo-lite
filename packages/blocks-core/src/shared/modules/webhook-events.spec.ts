import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { corePlugin } from "../../plugin"
import { CHATBOT_WEBHOOK_EVENTS } from "../../agents/chatbot/webhook-events"
import { MODULE_DECLARATIONS } from "./module-declarations"
import { SALES_WEBHOOK_EVENTS } from "../../agents/sales/webhook-events"

describe("the outgoing webhook events of the modules", () => {
    const events = [...CHATBOT_WEBHOOK_EVENTS, ...SALES_WEBHOOK_EVENTS]

    it("declares each event of the former engine list once, with a label in both languages", () => {
        expect(events.map((event) => event.id).sort()).toEqual(
            ["deal.won", "handoff.requested", "lead.created", "order.confirmed", "payment.received"].sort(),
        )
        for (const event of events) {
            expect(event.label.vi).not.toBe("")
            expect(event.label.en).not.toBe("")
        }
    })

    it("names, for each event, a module the plugin declares", () => {
        const keys = MODULE_DECLARATIONS.map((module) => module.key)
        for (const event of events) expect(keys).toContain(event.moduleKey)
    })

    it("joins the installation through the plugin, each event once", () => {
        const installed = defineInstallation([corePlugin], "h").webhookEvents
        expect(installed.map((event) => event.id).sort()).toEqual(events.map((event) => event.id).sort())
    })
})
