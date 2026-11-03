import { graphNodeStepOf, localeOf, outputsOf, tagSourceOf, triggerScopeOf } from "./graph-flow.policy"
import type { FlowWake } from "./graph-flow.policy"

const wake = (overrides: Partial<FlowWake> = {}): FlowWake => ({ source: "tag", context: {}, actorMemberId: null, ...overrides })

describe("tagSourceOf", () => {
    it("names where a wake came from in the words of a tag trigger", () => {
        expect(tagSourceOf(wake({ source: "schedule" }))).toBe("schedule")
        expect(tagSourceOf(wake({ source: "internal" }))).toBe("system-event")
        expect(tagSourceOf(wake({ context: { tagSource: "sepay" } }))).toBe("system-event")
        expect(tagSourceOf(wake({ context: { authorAgentId: "a-2" } }))).toBe("agent")
        expect(tagSourceOf(wake({ actorMemberId: "m-1" }))).toBe("chats-group")
        expect(tagSourceOf(wake({ context: { authorUserId: "u-1" } }))).toBe("chats-group")
        expect(tagSourceOf(wake({ source: "customer" }))).toBe("channel")
        expect(tagSourceOf(wake({ context: { conversationId: "c-1" } }))).toBe("channel")
        expect(tagSourceOf(wake())).toBe("agent")
    })
})

describe("triggerScopeOf", () => {
    it("keeps the flat context, parses the tag's data as context, and names the source, origin and language", () => {
        const scope = triggerScopeOf(
            wake({
                context: {
                    text: "2 chậu",
                    conversationId: "c-1",
                    leadId: "l-1",
                    tagContext: '{"items":[{"name":"Lan"}]}',
                    authorAgentId: "a-2",
                    locale: "en",
                },
            }),
        )
        expect(scope).toEqual({
            text: "2 chậu",
            conversationId: "c-1",
            leadId: "l-1",
            authorAgentId: "a-2",
            locale: "en",
            context: { items: [{ name: "Lan" }] },
            source: "agent",
            origin: "agent",
        })
        expect(triggerScopeOf(wake({ context: { tagSource: "sepay" } }))).toMatchObject({
            source: "sepay",
            origin: "system-event",
            context: {},
            locale: "vi",
        })
    })

    it("speaks Vietnamese unless the trigger says English", () => {
        expect(localeOf({ locale: "fr" })).toBe("vi")
        expect(localeOf({ locale: "en" })).toBe("en")
    })
})

describe("graphNodeStepOf", () => {
    const node = { key: "record", kind: "output" as const, step: "order.record" }
    const input = { versionId: "v-1", nodeKey: "record", trigger: {} }

    it("keys the step by its node and gives it the saga kind of its node", () => {
        expect(graphNodeStepOf(node, input, "compensable")).toEqual({
            stepKey: "record",
            nodeKey: "record",
            kind: "graph_node",
            effect: { kind: "compensable", compensation: "graph_node" },
            input,
        })
        expect(graphNodeStepOf(node, input, "pivot").effect).toEqual({ kind: "pivot" })
        expect(graphNodeStepOf(node, input, "read").effect).toEqual({ kind: "read" })
    })

    it("reads the output each done step kept, by node key", () => {
        expect(outputsOf({ record: { output: { orderId: "o-1" } }, gone: {} })).toEqual({
            record: { orderId: "o-1" },
            gone: undefined,
        })
    })
})
