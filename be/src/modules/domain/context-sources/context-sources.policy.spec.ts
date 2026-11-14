import { Test } from "@nestjs/testing"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    CONTEXT_SOURCES,
    DEFAULT_READ_TOOLS,
    LOCKED_CONTEXT_TOOLS,
    boundedLimitOf,
    isDefaultRead,
    isLockedContextRead,
    sourceOfTool,
} from "./context-sources.policy"

const SUBJECT = Symbol("context-sources.policy")

/** A list's default and its most, as a list read bounds its count (the bounds of the latest orders of a person, the sample the case always used). */
const LIST_BOUNDS = { fallback: 5, max: 10 } as const

/** The functions of the policy under test, as Nest provides them. */
interface Subject {
    readonly boundedLimitOf: typeof boundedLimitOf
    readonly isDefaultRead: typeof isDefaultRead
    readonly isLockedContextRead: typeof isLockedContextRead
    readonly sourceOfTool: typeof sourceOfTool
}

/** The subject, built the way Nest provides it. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { boundedLimitOf, isDefaultRead, isLockedContextRead, sourceOfTool } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("context-sources.policy: the registry", () => {
    it("registers the brain, the conversation, the contact and the sales lead on one shape", () => {
        expect(CONTEXT_SOURCES.map((source) => [source.key, source.scope])).toEqual([
            ["nivo.brain", "shop"],
            ["nivo.conversation", "customer"],
            ["nivo.contact", "customer"],
            ["nivo.lead", "customer"],
        ])
        for (const source of CONTEXT_SOURCES) {
            expect([source.lens, source.brief].every((text) => text.length > 0)).toBe(true)
            expect(source.tools.length).toBeGreaterThan(0)
        }
    })

    it("grants every read by default and locks only the customer's to the run", async () => {
        const subject = await build()
        expect(DEFAULT_READ_TOOLS).toEqual([
            TOOL.brainFactGet,
            TOOL.brainFactRelated,
            TOOL.brainPassageRead,
            TOOL.brainPassageSearch,
            TOOL.brainSearch,
            TOOL.contactGet,
            TOOL.conversationMessageList,
            TOOL.leadCareGet,
            TOOL.leadOrderList,
        ])
        expect(subject.isLockedContextRead(TOOL.leadCareGet)).toBe(true)
        expect(LOCKED_CONTEXT_TOOLS).not.toContain(TOOL.brainSearch)
        expect(LOCKED_CONTEXT_TOOLS).not.toContain(TOOL.brainPassageSearch)
        expect(subject.sourceOfTool(TOOL.brainPassageRead)?.key).toBe("nivo.brain")
        expect(subject.isDefaultRead(TOOL.brainSearch) && subject.isDefaultRead(TOOL.leadOrderList)).toBe(true)
        expect(subject.isLockedContextRead(TOOL.leadOrderList)).toBe(true)
        expect(subject.isDefaultRead(TOOL.customerMessageSend) || subject.isLockedContextRead(TOOL.customerMessageSend)).toBe(false)
        expect(subject.sourceOfTool(TOOL.contactGet)?.key).toBe("nivo.contact")
        expect(subject.isLockedContextRead(TOOL.contactGet)).toBe(true)
        expect(subject.sourceOfTool("nivo.tool.ledger.entry.append")).toBeNull()
    })

    it("bounds a wanted count between one and the list's most, its default when none is asked", async () => {
        const subject = await build()
        expect([subject.boundedLimitOf(undefined, LIST_BOUNDS), subject.boundedLimitOf(99, LIST_BOUNDS), subject.boundedLimitOf(0, LIST_BOUNDS)]).toEqual([
            5, 10, 1,
        ])
    })
})
