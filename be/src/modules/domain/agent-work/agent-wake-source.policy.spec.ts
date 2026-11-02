import { Test } from "@nestjs/testing"
import { WAKE_SOURCE_KEY, WakeSourcesPolicy, wakeSources } from "./agent-wake-source.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentWakeTraits } from "./agent-work-source.contracts"

const SUBJECT = Symbol("agent-wake-source.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: new WakeSourcesPolicy() }],
    }).compile()
    return moduleRef.get<WakeSourcesPolicy>(SUBJECT)
}

const traits = (over: Partial<AgentWakeTraits> = {}): AgentWakeTraits => ({
    priority: 25,
    maxAttempts: 3,
    scopedToConversation: false,
    background: false,
    restoresHeld: true,
    awaitsAnswer: false,
    ...over,
})

const codeOf = (run: () => unknown): unknown => {
    try {
        run()
        return null
    } catch (cause) {
        return cause instanceof AgentWorkError ? cause.code : cause
    }
}

describe("WakeSourcesPolicy built-in sources", () => {
    it("gives the four sources that existed before adapters exactly the traits the work core always gave them", async () => {
        const table = await buildSubject()

        expect(table.of("customer")).toEqual({
            priority: 10,
            maxAttempts: 2,
            scopedToConversation: true,
            background: false,
            restoresHeld: true,
            awaitsAnswer: true,
        })
        expect(table.of("tag")).toEqual({
            priority: 20,
            maxAttempts: 3,
            scopedToConversation: false,
            background: false,
            restoresHeld: true,
            awaitsAnswer: false,
        })
        expect(table.of("internal")).toEqual({
            priority: 30,
            maxAttempts: 3,
            scopedToConversation: false,
            background: true,
            restoresHeld: false,
            awaitsAnswer: false,
        })
        expect(table.of("schedule")).toEqual({
            priority: 40,
            maxAttempts: 3,
            scopedToConversation: false,
            background: true,
            restoresHeld: false,
            awaitsAnswer: false,
        })
        expect(table.builtIn()).toEqual(["customer", "tag", "internal", "schedule"])
        expect(table.registered()).toEqual(table.builtIn())
    })
})

describe("WakeSourcesPolicy.add", () => {
    it("records a new source, and recording the same traits again changes nothing", async () => {
        const table = await buildSubject()

        table.add("invoice_hook", traits())
        table.add("invoice_hook", traits())
        table.add("customer", table.of("customer"))

        expect(table.of("invoice_hook")).toEqual(traits())
        expect(table.lookup("invoice_hook")).toEqual(traits())
        expect(table.registered()).toEqual(["customer", "tag", "internal", "schedule", "invoice_hook"])
    })

    it("refuses other traits for a known source, so two adapters cannot disagree about one key", async () => {
        const table = await buildSubject()

        expect(codeOf(() => table.add("customer", traits()))).toBe(AgentWorkErrorCode.SourceInvalid)
        table.add("invoice_hook", traits())
        expect(codeOf(() => table.add("invoice_hook", traits({ priority: 99 })))).toBe(AgentWorkErrorCode.SourceInvalid)
    })

    it.each(["", "Upper", "1starts_with_digit", "has space", "x".repeat(41)])("refuses the key %j", async (key) => {
        const table = await buildSubject()

        expect(codeOf(() => table.add(key, traits()))).toBe(AgentWorkErrorCode.SourceInvalid)
    })

    it("notices each field of the traits when it compares two", async () => {
        const table = await buildSubject()
        table.add("fielded", traits())

        const changes: ReadonlyArray<Partial<AgentWakeTraits>> = [
            { maxAttempts: 9 },
            { scopedToConversation: true },
            { background: true },
            { restoresHeld: false },
            { awaitsAnswer: true },
        ]
        changes.forEach((change) => {
            expect(codeOf(() => table.add("fielded", traits(change)))).toBe(AgentWorkErrorCode.SourceInvalid)
        })
    })
})

describe("WakeSourcesPolicy lookups", () => {
    it("finds nothing for an unknown source and refuses to answer its traits", async () => {
        const table = await buildSubject()

        expect(table.lookup("nobody")).toBeUndefined()
        expect(codeOf(() => table.of("nobody"))).toBe(AgentWorkErrorCode.SourceUnknown)
    })

    it("shares one process table whose key shape is the one the database checks", () => {
        expect(wakeSources.lookup("customer")?.priority).toBe(10)
        expect(WAKE_SOURCE_KEY.test("generic_webhook")).toBe(true)
        expect(WAKE_SOURCE_KEY.test("Generic")).toBe(false)
    })
})
