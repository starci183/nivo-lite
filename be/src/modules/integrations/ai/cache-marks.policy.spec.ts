import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { automaticCacheFieldsOf as automaticCacheFieldsOfSubject, CACHE_MARK_KINDS as CACHE_MARK_KINDSSubject, MAX_CACHE_BREAKPOINTS as MAX_CACHE_BREAKPOINTSSubject, MAX_EXPLICIT_MARKS as MAX_EXPLICIT_MARKSSubject, markedContentOf as markedContentOfSubject, withinMarkLimit as withinMarkLimitSubject } from "./cache-marks.policy"

const SUBJECT = Symbol("cache-marks.policy")

describe("cache-marks.policy built the way Nest does", () => {
    let automaticCacheFieldsOf: typeof automaticCacheFieldsOfSubject
    let CACHE_MARK_KINDS: typeof CACHE_MARK_KINDSSubject
    let MAX_CACHE_BREAKPOINTS: typeof MAX_CACHE_BREAKPOINTSSubject
    let MAX_EXPLICIT_MARKS: typeof MAX_EXPLICIT_MARKSSubject
    let markedContentOf: typeof markedContentOfSubject
    let withinMarkLimit: typeof withinMarkLimitSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ automaticCacheFieldsOf: typeof automaticCacheFieldsOfSubject; CACHE_MARK_KINDS: typeof CACHE_MARK_KINDSSubject; MAX_CACHE_BREAKPOINTS: typeof MAX_CACHE_BREAKPOINTSSubject; MAX_EXPLICIT_MARKS: typeof MAX_EXPLICIT_MARKSSubject; markedContentOf: typeof markedContentOfSubject; withinMarkLimit: typeof withinMarkLimitSubject }>({ automaticCacheFieldsOf: automaticCacheFieldsOfSubject, CACHE_MARK_KINDS: CACHE_MARK_KINDSSubject, MAX_CACHE_BREAKPOINTS: MAX_CACHE_BREAKPOINTSSubject, MAX_EXPLICIT_MARKS: MAX_EXPLICIT_MARKSSubject, markedContentOf: markedContentOfSubject, withinMarkLimit: withinMarkLimitSubject }) }],
        }).compile()
        ;({ automaticCacheFieldsOf, CACHE_MARK_KINDS, MAX_CACHE_BREAKPOINTS, MAX_EXPLICIT_MARKS, markedContentOf, withinMarkLimit } = moduleRef.get<{ automaticCacheFieldsOf: typeof automaticCacheFieldsOfSubject; CACHE_MARK_KINDS: typeof CACHE_MARK_KINDSSubject; MAX_CACHE_BREAKPOINTS: typeof MAX_CACHE_BREAKPOINTSSubject; MAX_EXPLICIT_MARKS: typeof MAX_EXPLICIT_MARKSSubject; markedContentOf: typeof markedContentOfSubject; withinMarkLimit: typeof withinMarkLimitSubject }>(SUBJECT))
    })

describe("markedContentOf", () => {
    it("marks only on the protocol that takes breakpoints: anthropic yes, openai never", () => {
        expect(CACHE_MARK_KINDS).toEqual({ anthropic: true, openai: false })
        expect(markedContentOf("stable", true, CACHE_MARK_KINDS.openai)).toBe("stable")
    })

    it("gives a marked message one text part with an ephemeral breakpoint, the text unchanged byte for byte", () => {
        expect(markedContentOf("stable", true, CACHE_MARK_KINDS.anthropic)).toEqual([
            { type: "text", text: "stable", cache_control: { type: "ephemeral" } },
        ])
        expect(markedContentOf("volatile", false, CACHE_MARK_KINDS.anthropic)).toBe("volatile")
    })
})

describe("withinMarkLimit", () => {
    it("keeps the first three marks and drops every later one, never a message: three explicit + the automatic one = four", () => {
        const messages = [1, 2, 3, 4, 5].map((n) => ({ role: "system" as const, content: `L${String(n)}`, cacheMark: true }))

        const kept = withinMarkLimit([...messages, { role: "user", content: "input" }])

        expect(MAX_EXPLICIT_MARKS + 1).toBe(MAX_CACHE_BREAKPOINTS)
        expect(kept.map((message) => message.content)).toEqual(["L1", "L2", "L3", "L4", "L5", "input"])
        expect(kept.map((message) => message.cacheMark === true)).toEqual([true, true, true, false, false, false])
    })
})

describe("automaticCacheFieldsOf", () => {
    it("turns on the automatic (top-level) breakpoint for anthropic only", () => {
        expect(automaticCacheFieldsOf()).toEqual({ anthropic: { invocationKwargs: { cache_control: { type: "ephemeral" } } } })
        expect(automaticCacheFieldsOf()).not.toHaveProperty("openai")
    })
})
})
