import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { WORKFLOW_CALL_TRIGGER as realTrigger } from "./workflow-call.trigger"

const SUBJECT = Symbol("workflow-call.trigger")

const buildSubject = async (): Promise<typeof realTrigger> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: realTrigger }] }).compile()
    return moduleRef.get<typeof realTrigger>(SUBJECT)
}

const NO_ACCOUNT = { connectionId: null }

describe("the workflow call's trigger", () => {
    it("is the engine's call verb, received inside NIVO, keyed by the caller's person", async () => {
        const trigger = await buildSubject()

        expect([trigger.provider, trigger.verb, trigger.via, trigger.key]).toEqual([PROVIDER.nivo, TRIGGER.workflowCalled, "internal", { by: "contact" }])
    })

    it("translates a call into one event under the caller's key, its data the params exactly as mapped (the pin is the delivery's, not the event's), purely", async () => {
        const trigger = await buildSubject()
        const call = { key: "call:run-1:step-2", params: { contactId: "c-1", lines: ["a"] } }

        const event = trigger.translate(call, NO_ACCOUNT)
        expect(event).toEqual({ id: "call:run-1:step-2", data: { contactId: "c-1", lines: ["a"] } })
        expect(trigger.translate(call, NO_ACCOUNT)).toEqual(event)
        expect(trigger.data.safeParse(event?.data).success).toBe(true)
        expect(trigger.translate({ ...call, key: "" }, NO_ACCOUNT)).toBeNull()
    })

    it("refuses a raw whose params are no record", async () => {
        const trigger = await buildSubject()

        expect(trigger.raw.safeParse({ key: "k", params: {} }).success).toBe(true)
        expect(trigger.raw.safeParse({ key: "k", params: ["a"] }).success).toBe(false)
        expect(trigger.raw.safeParse({ params: {} }).success).toBe(false)
    })
})
