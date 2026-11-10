import { Test } from "@nestjs/testing"
import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    graphNodeStepOf,
    localeOf,
    nodeBlocks,
    outputsOf,
    subjectOfLabel,
    tagSourceOf,
    triggerScopeOf,
} from "./graph-flow.policy"
import type { FlowWake } from "./graph-flow.policy"

/** The members of the subject under test. */
interface Subject {
    readonly tagSourceOf: typeof tagSourceOf
    readonly triggerScopeOf: typeof triggerScopeOf
    readonly localeOf: typeof localeOf
    readonly graphNodeStepOf: typeof graphNodeStepOf
    readonly outputsOf: typeof outputsOf
    readonly subjectOfLabel: typeof subjectOfLabel
    readonly nodeBlocks: typeof nodeBlocks
}

const SUBJECT = Symbol("graph-flow.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    tagSourceOf,
                    triggerScopeOf,
                    localeOf,
                    graphNodeStepOf,
                    outputsOf,
                    subjectOfLabel,
                    nodeBlocks,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const wake = (overrides: Partial<FlowWake> = {}): FlowWake => ({
    source: "tag",
    context: {},
    actorMemberId: null,
    ...overrides,
})

describe("tagSourceOf", () => {
    it("names where a wake came from in the words of a tag trigger", async () => {
        const policy = await build()
        expect(policy.tagSourceOf(wake({ source: "schedule" }))).toBe("schedule")
        expect(policy.tagSourceOf(wake({ source: "internal" }))).toBe("system-event")
        expect(policy.tagSourceOf(wake({ context: { tagSource: "sepay" } }))).toBe("system-event")
        expect(policy.tagSourceOf(wake({ context: { authorAgentId: "a-2" } }))).toBe("agent")
        expect(policy.tagSourceOf(wake({ actorMemberId: "m-1" }))).toBe("chats-group")
        expect(policy.tagSourceOf(wake({ context: { authorUserId: "u-1" } }))).toBe("chats-group")
        expect(policy.tagSourceOf(wake({ source: "customer" }))).toBe("channel")
        expect(policy.tagSourceOf(wake({ context: { conversationId: "c-1" } }))).toBe("channel")
        expect(policy.tagSourceOf(wake())).toBe("agent")
    })
})

describe("triggerScopeOf", () => {
    it("keeps the flat context, parses the tag's data as context, and names the source, origin and language", async () => {
        const policy = await build()
        const scope = policy.triggerScopeOf(
            wake({
                context: {
                    text: "2 pots",
                    conversationId: "c-1",
                    leadId: "l-1",
                    tagContext: '{"items":[{"name":"Lan"}]}',
                    authorAgentId: "a-2",
                    locale: "en",
                    subject: "order:o-1",
                },
            }),
        )
        expect(scope).toEqual({
            text: "2 pots",
            conversationId: "c-1",
            leadId: "l-1",
            authorAgentId: "a-2",
            locale: "en",
            subject: { kind: "order", id: "o-1" },
            context: { items: [{ name: "Lan" }] },
            items: [{ name: "Lan" }],
            source: "agent",
            origin: "agent",
        })
        expect(policy.triggerScopeOf(wake({ context: { tagSource: "sepay" } }))).toMatchObject({
            source: "sepay",
            origin: "system-event",
            subject: null,
            context: {},
            locale: "vi",
        })
    })

    it("speaks Vietnamese unless the trigger says English", async () => {
        const policy = await build()
        expect(policy.localeOf({ locale: "fr" })).toBe("vi")
        expect(policy.localeOf({ locale: "en" })).toBe("en")
    })
})

describe("graphNodeStepOf", () => {
    const node = { key: "record", kind: "output" as const, step: "sales.order-from-chat" }
    const input = { versionId: "v-1", nodeKey: "record", trigger: {} }

    it("keys the step by its node and gives it the saga kind of its node", async () => {
        const policy = await build()
        expect(policy.graphNodeStepOf(node, input, "compensable")).toEqual({
            stepKey: "record",
            nodeKey: "record",
            kind: "graph_node",
            effect: { kind: "compensable", compensation: "graph_node" },
            input,
        })
        expect(policy.graphNodeStepOf(node, input, "pivot").effect).toEqual({ kind: "pivot" })
        expect(policy.graphNodeStepOf(node, input, "read").effect).toEqual({ kind: "read" })
    })

    it("reads the output each done step kept, by node key", async () => {
        const policy = await build()
        expect(policy.outputsOf({ record: { output: { orderId: "o-1" } }, gone: {} })).toEqual({
            record: { orderId: "o-1" },
            gone: undefined,
        })
    })
})

describe("subjectOfLabel", () => {
    it("reads a `<kind>:<id>` label as a subject, and nothing else", async () => {
        const policy = await build()
        expect(policy.subjectOfLabel("bank-transaction:t-1")).toEqual({ kind: "bank-transaction", id: "t-1" })
        expect(policy.subjectOfLabel("a label")).toBeNull()
        expect(policy.subjectOfLabel(":x")).toBeNull()
        expect(policy.subjectOfLabel("x:")).toBeNull()
        expect(policy.subjectOfLabel(1)).toBeNull()
        expect(policy.triggerScopeOf(wake({ context: { subject: "a label" } })).subject).toBe("a label")
    })
})

describe("nodeBlocks", () => {
    const node = (blocking?: boolean): GraphSpecNode => ({
        key: "notify",
        kind: "output",
        step: "sales.order-notice",
        ...(blocking === undefined ? {} : { blocking }),
    })

    it("blocks by default, and lets a side node (`blocking: false`) be passed over", async () => {
        const policy = await build()
        expect(policy.nodeBlocks(node(), undefined)).toBe(true)
        expect(policy.nodeBlocks(node(), true)).toBe(true)
        expect(policy.nodeBlocks(node(), false)).toBe(false)
    })

    it("takes the graph node's own word over the definition's", async () => {
        const policy = await build()
        expect(policy.nodeBlocks(node(true), false)).toBe(true)
        expect(policy.nodeBlocks(node(false), undefined)).toBe(false)
    })
})
