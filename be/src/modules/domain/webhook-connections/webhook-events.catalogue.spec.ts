import { ENGINE_WEBHOOK_EVENTS, installedWebhookEvents, webhookEventOptions } from "./webhook-events.catalogue"

const LABEL = { vi: "vi", en: "en" }

describe("webhookEventOptions", () => {
    it("lists the declared events in order, then the engine's own, with a null summary and an empty sample by default", () => {
        const options = webhookEventOptions([
            { id: "deal.won", label: LABEL },
            { id: "lead.created", label: LABEL, summary: LABEL, sample: { name: "x" } },
        ])
        expect(options.map((option) => option.id)).toEqual(["deal.won", "lead.created", "decision.made"])
        expect(options[0]).toEqual({ id: "deal.won", label: LABEL, summary: null, sample: {} })
        expect(options[1]).toEqual({ id: "lead.created", label: LABEL, summary: LABEL, sample: { name: "x" } })
    })

    it("lists each id once: an engine id wins over a plugin's, and a repeat is dropped", () => {
        const options = webhookEventOptions([
            { id: "decision.made", label: { vi: "kh\u00E1c", en: "other" } },
            { id: "deal.won", label: LABEL },
            { id: "deal.won", label: { vi: "l\u1EA1i", en: "again" } },
        ])
        expect(options.map((option) => option.id)).toEqual(["deal.won", "decision.made"])
        expect(options[1]).toBe(ENGINE_WEBHOOK_EVENTS[0])
        expect(options[0]?.label).toEqual(LABEL)
    })

    it("offers only the engine's events when nothing is declared", () => {
        expect(webhookEventOptions([])).toEqual(ENGINE_WEBHOOK_EVENTS)
    })
})

describe("installedWebhookEvents", () => {
    it("reads the installation: the events its plugins declare, each with a label in both languages, and the engine's", () => {
        const options = installedWebhookEvents()
        expect(options.map((option) => option.id)).toContain("decision.made")
        for (const option of options) {
            expect(option.label.vi).not.toBe("")
            expect(option.label.en).not.toBe("")
        }
        expect(new Set(options.map((option) => option.id)).size).toBe(options.length)
    })
})
