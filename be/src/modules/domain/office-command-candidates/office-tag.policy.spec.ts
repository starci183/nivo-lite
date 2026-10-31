import { Test } from "@nestjs/testing"
import type { AgentHandleCard } from "@modules/domain/agents"
import type { TranscriptLine } from "./office-command-candidates.contracts"
import {
    holdLineKeyOf,
    isHeldReason,
    MAX_TAGS,
    TRANSCRIPT_SIZE,
    taggedAgentsOf,
    transcriptOf,
} from "./office-tag.policy"

const SUBJECT = Symbol("office-tag.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { holdLineKeyOf, isHeldReason, taggedAgentsOf, transcriptOf } }],
    }).compile()
    return moduleRef.get<{
        holdLineKeyOf: typeof holdLineKeyOf
        isHeldReason: typeof isHeldReason
        taggedAgentsOf: typeof taggedAgentsOf
        transcriptOf: typeof transcriptOf
    }>(SUBJECT)
}

const agent = (handle: string): AgentHandleCard => ({
    id: `id-${handle}`,
    handle,
    module: "accounting",
    name: handle.toUpperCase(),
})

const line = (id: string, author = "Lan", body = `line ${id}`): TranscriptLine => ({ id, author, body })

describe("office-tag.policy > taggedAgentsOf", () => {
    it("keeps the order the author wrote and drops a handle nobody holds", async () => {
        const policy = await build()

        expect(policy.taggedAgentsOf(["b", "ghost", "a"], [agent("a"), agent("b")])).toEqual([agent("b"), agent("a")])
    })

    it("answers none for no handle and cuts a long list to the cap", async () => {
        const policy = await build()
        const handles = ["a", "b", "c", "d", "e"]

        expect(policy.taggedAgentsOf([], [agent("a")])).toEqual([])
        expect(policy.taggedAgentsOf(handles, handles.map(agent))).toEqual(handles.slice(0, MAX_TAGS).map(agent))
    })
})

describe("office-tag.policy > transcriptOf", () => {
    it("lists the earlier lines oldest first and marks the line that tagged the agent last", async () => {
        const policy = await build()

        expect(
            policy.transcriptOf(
                [line("1", "An", "hi"), line("2", "Lan", "hello")],
                line("3", "Mai", "@ke-toan how much?"),
            ),
        ).toBe("An: hi\nLan: hello\n-> Mai: @ke-toan how much?")
    })

    it("is only the tagging line when nothing was said before", async () => {
        const policy = await build()

        expect(policy.transcriptOf([], line("1", "Mai", "@a ping"))).toBe("-> Mai: @a ping")
    })

    it("never repeats the tagging line and keeps only the most recent lines", async () => {
        const policy = await build()
        const before = Array.from({ length: TRANSCRIPT_SIZE + 5 }, (_, index) => line(String(index)))
        const tagged = line("tag", "Mai", "now")

        const text = policy.transcriptOf([...before, tagged], tagged).split("\n")

        expect(text).toHaveLength(TRANSCRIPT_SIZE + 1)
        expect(text.at(-1)).toBe("-> Mai: now")
        expect(text[0]).toBe("Lan: line 5")
    })
})

describe("office-tag.policy > holdLineKeyOf", () => {
    it.each([
        ["quota", "office.tagQuota"],
        ["killed", "office.tagWorkOff"],
        ["breaker", "office.tagBusy"],
        ["daily_cap", "office.tagBusy"],
        ["openclaw_not_configured", "office.tagBusy"],
        ["something_else", "office.tagFailed"],
    ])("answers %s with %s", async (reason, key) => {
        const policy = await build()

        expect(policy.holdLineKeyOf(reason)).toBe(key)
    })

    it("holds a wake only while work is switched off", async () => {
        const policy = await build()

        expect(policy.isHeldReason("killed")).toBe(true)
        expect(policy.isHeldReason("quota")).toBe(false)
    })
})
