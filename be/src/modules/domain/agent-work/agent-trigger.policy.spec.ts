import { Test } from "@nestjs/testing"
import { triggerFields } from "./agent-trigger.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentTriggerWrite } from "./agent-work.contracts"

const SUBJECT = Symbol("agent-trigger.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { triggerFields } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-trigger.policy")>(SUBJECT)
}

const write = (over: Partial<AgentTriggerWrite> = {}): AgentTriggerWrite => ({
    workspaceId: "ws-1",
    agentId: "agent-1",
    triggerId: null,
    kind: "schedule",
    preset: "daily_at",
    atTime: "08:30",
    timeZone: null,
    eventName: null,
    probeKey: "invoices_due",
    enabled: true,
    ...over,
})

const refusal = async (input: AgentTriggerWrite): Promise<unknown> => {
    const { triggerFields } = await buildSubject()
    try {
        triggerFields(input, "Asia/Ho_Chi_Minh")
        return null
    } catch (cause) {
        return cause
    }
}

describe("triggerFields", () => {
    it("keeps the time of day of a daily preset and defaults its zone", async () => {
        const { triggerFields } = await buildSubject()
        expect(triggerFields(write(), "Asia/Ho_Chi_Minh")).toEqual({
            kind: "schedule",
            preset: "daily_at",
            atTime: "08:30",
            timeZone: "Asia/Ho_Chi_Minh",
            eventName: null,
            probeKey: "invoices_due",
            enabled: true,
            sources: [],
        })
    })

    it("defaults the zone of a clock and of an event to the workspace's own zone", async () => {
        const { triggerFields } = await buildSubject()
        expect(triggerFields(write(), "Europe/London")).toMatchObject({ timeZone: "Europe/London" })
        expect(
            triggerFields(write({ kind: "event", preset: null, atTime: null, eventName: "bank_credit_booked" }), "Europe/London"),
        ).toMatchObject({ timeZone: "Europe/London" })
        expect(triggerFields(write({ timeZone: "Asia/Bangkok" }), "Europe/London")).toMatchObject({ timeZone: "Asia/Bangkok" })
    })

    it("takes the weekday preset with its time and the zone the owner chose", async () => {
        const { triggerFields } = await buildSubject()
        expect(triggerFields(write({ preset: "weekdays_at", timeZone: "Asia/Bangkok" }), "Asia/Ho_Chi_Minh")).toMatchObject({
            preset: "weekdays_at",
            atTime: "08:30",
            timeZone: "Asia/Bangkok",
        })
    })

    it.each(["every_15m", "hourly"] as const)("drops the time of day of the %s preset", async (preset) => {
        const { triggerFields } = await buildSubject()
        expect(triggerFields(write({ preset, atTime: "08:30" }), "Asia/Ho_Chi_Minh")).toMatchObject({ preset, atTime: null })
    })

    it("builds an event trigger from its name", async () => {
        const { triggerFields } = await buildSubject()
        expect(
            triggerFields(write({ kind: "event", preset: null, atTime: "08:30", eventName: "bank_credit_booked" }), "Asia/Ho_Chi_Minh"),
        ).toEqual({
            kind: "event",
            preset: null,
            atTime: null,
            timeZone: "Asia/Ho_Chi_Minh",
            eventName: "bank_credit_booked",
            probeKey: "invoices_due",
            enabled: true,
            sources: [],
        })
    })
})

describe("triggerFields for the sources of an event trigger", () => {
    it("keeps the distinct sources an event trigger names", async () => {
        const { triggerFields } = await buildSubject()
        const fields = triggerFields(
            write({
                kind: "event",
                preset: null,
                eventName: "invoice.paid",
                sources: ["generic_webhook", "generic_webhook", "tag"],
            }),
            "Asia/Ho_Chi_Minh",
        )
        expect(fields.sources).toEqual(["generic_webhook", "tag"])
    })

    it.each([
        ["a source that is not a key", ["Not A Key"]],
        ["more sources than a trigger may name", Array.from({ length: 11 }, (_, at) => "source_" + String(at))],
    ])("refuses %s", async (_name, sources) => {
        const input = write({ kind: "event", preset: null, eventName: "invoice.paid", sources })
        expect(await refusal(input)).toEqual(expect.objectContaining({ code: AgentWorkErrorCode.TriggerShapeInvalid }))
    })
})

describe("triggerFields refusals", () => {
    it.each(["25:00", "8:30", "08:60", "noon"])("refuses the time %s of a daily preset", async (atTime) => {
        expect(await refusal(write({ atTime }))).toEqual(
            expect.objectContaining({ code: AgentWorkErrorCode.TimeInvalid }),
        )
    })

    it("refuses a daily preset with no time", async () => {
        expect(await refusal(write({ atTime: null }))).toBeInstanceOf(AgentWorkError)
    })

    it.each([
        ["a clock with no preset", write({ preset: null })],
        ["a clock that names an event", write({ eventName: "bank_credit_booked" })],
        ["an event with no name", write({ kind: "event", preset: null })],
        ["an event with an empty name", write({ kind: "event", preset: null, eventName: "" })],
        ["an event that names a preset", write({ kind: "event", eventName: "bank_credit_booked" })],
    ])("refuses %s", async (_name, input) => {
        expect(await refusal(input)).toEqual(expect.objectContaining({ code: AgentWorkErrorCode.TriggerShapeInvalid }))
    })
})
