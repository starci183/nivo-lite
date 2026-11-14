import { Test } from "@nestjs/testing"
import { ENGINE_THREAD_SOURCE, WakeSourcesPolicy, wakeSources } from "./agent-wake-source.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentWakeTraits } from "@modules/domain/agent-wake-rules"

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
    it("gives the built-in sources exactly their traits (the old `customer` source is gone: a person's line is a pipeline event)", async () => {
        const table = await buildSubject()

        expect(table.lookup("customer")).toBeUndefined()
        expect(table.of("trigger")).toEqual({
            priority: 10,
            maxAttempts: 3,
            scopedToConversation: false,
            background: false,
            restoresHeld: true,
            awaitsAnswer: false,
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
        expect(table.builtIn()).toEqual(["tag", "internal", "trigger", "schedule"])
        expect(table.registered()).toEqual(table.builtIn())
    })
})

describe("WakeSourcesPolicy engine sources", () => {
    it("knows the thread source: a person waits on it, it restores when work is switched back on, three tries, not background", async () => {
        const table = await buildSubject()

        expect(ENGINE_THREAD_SOURCE).toBe("thread")
        expect(table.of(ENGINE_THREAD_SOURCE)).toEqual({
            priority: 15,
            maxAttempts: 3,
            scopedToConversation: false,
            background: false,
            restoresHeld: true,
            awaitsAnswer: false,
        })
    })

    it("never offers the thread source to a trigger, and refuses other traits for it", async () => {
        const table = await buildSubject()

        expect(table.registered()).not.toContain(ENGINE_THREAD_SOURCE)
        expect(table.builtIn()).not.toContain(ENGINE_THREAD_SOURCE)
        expect(codeOf(() => table.add(ENGINE_THREAD_SOURCE, traits({ background: true })))).toBe(
            AgentWorkErrorCode.SourceInvalid,
        )
        expect(wakeSources.lookup(ENGINE_THREAD_SOURCE)?.restoresHeld).toBe(true)
    })
})

describe("WakeSourcesPolicy.add", () => {
    it("records a new source, and recording the same traits again changes nothing", async () => {
        const table = await buildSubject()

        table.add("invoice_hook", traits())
        table.add("invoice_hook", traits())
        table.add("trigger", table.of("trigger"))

        expect(table.of("invoice_hook")).toEqual(traits())
        expect(table.lookup("invoice_hook")).toEqual(traits())
        expect(table.registered()).toEqual(["tag", "internal", "trigger", "schedule", "invoice_hook"])
    })

    it("refuses other traits for a known source, so two adapters cannot disagree about one key", async () => {
        const table = await buildSubject()

        expect(codeOf(() => table.add("trigger", traits()))).toBe(AgentWorkErrorCode.SourceInvalid)
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

    it("shares one process table", () => {
        expect(wakeSources.lookup("trigger")?.priority).toBe(10)
    })
})
