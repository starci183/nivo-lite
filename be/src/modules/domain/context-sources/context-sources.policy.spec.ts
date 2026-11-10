import { TOOL } from "@nivo-lite/blocks-core"
import {
    CONTEXT_SOURCES,
    DEFAULT_READ_TOOLS,
    LOCKED_CONTEXT_TOOLS,
    ORDER_ROWS,
    boundedLimitOf,
    isDefaultRead,
    isLockedContextRead,
    sourceOfTool,
} from "./context-sources.policy"

describe("context-sources.policy: the registry", () => {
    it("registers the brain, the conversation and the customer on one shape", () => {
        expect(CONTEXT_SOURCES.map((source) => [source.key, source.scope])).toEqual([
            ["nivo.brain", "shop"],
            ["nivo.conversation", "customer"],
            ["nivo.lead", "customer"],
        ])
        for (const source of CONTEXT_SOURCES) {
            expect([source.lens, source.brief].every((text) => text.length > 0)).toBe(true)
            expect(source.tools.length).toBeGreaterThan(0)
        }
    })

    it("grants every read by default and locks only the customer's to the run", () => {
        expect(DEFAULT_READ_TOOLS).toEqual([
            TOOL.brainFactGet,
            TOOL.brainFactRelated,
            TOOL.brainSearch,
            TOOL.conversationMessageList,
            TOOL.leadNoteList,
            TOOL.leadOrderList,
            TOOL.leadProfileGet,
        ])
        expect(LOCKED_CONTEXT_TOOLS).not.toContain(TOOL.brainSearch)
        expect(isDefaultRead(TOOL.brainSearch) && isDefaultRead(TOOL.leadOrderList)).toBe(true)
        expect(isLockedContextRead(TOOL.leadOrderList)).toBe(true)
        expect(isDefaultRead(TOOL.customerMessageSend) || isLockedContextRead(TOOL.customerMessageSend)).toBe(false)
        expect(sourceOfTool(TOOL.leadNoteList)?.key).toBe("nivo.lead")
        expect(sourceOfTool("nivo.ledger.entry.append")).toBeNull()
    })

    it("bounds a wanted count between one and the list's most, its default when none is asked", () => {
        expect([boundedLimitOf(undefined, ORDER_ROWS), boundedLimitOf(99, ORDER_ROWS), boundedLimitOf(0, ORDER_ROWS)]).toEqual([
            5, 10, 1,
        ])
    })
})
