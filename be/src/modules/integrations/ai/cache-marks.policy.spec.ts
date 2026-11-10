import {
    automaticCacheFieldsOf,
    CACHE_MARK_KINDS,
    MAX_CACHE_BREAKPOINTS,
    MAX_EXPLICIT_MARKS,
    markedContentOf,
    withinMarkLimit,
} from "./cache-marks.policy"

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
