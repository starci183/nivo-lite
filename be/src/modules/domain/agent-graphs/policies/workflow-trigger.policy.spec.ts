import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec, WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"
import * as policy from "./workflow-trigger.policy"

const SUBJECT = Symbol("workflow-trigger.policy")

/** The policy, bound as a kit double over its real functions. */
const policyDouble = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policyDouble }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}


const graphOf = (
    triggers: ReadonlyArray<WorkflowTrigger> | undefined,
    sources: ReadonlyArray<"channel" | "agent"> = ["channel"],
): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: [...sources] },
    ...(triggers === undefined ? {} : { triggers }),
    grant: { rights: [], tools: [], effects: [] },
    nodes: [],
})

const zalo = (key: string, extra: Partial<WorkflowTrigger> = {}): WorkflowTrigger => ({
    key,
    source: { kind: "zalo", connectionId: null },
    ...extra,
})

describe("workflowCallOf", () => {
    it("reads the pin of a hand-off: a key with latest or a positive whole version", async () => {
        const subject = await buildPolicy()
        expect(subject.workflowCallOf({ workflowCall: { workflow: "consult", version: "latest" } })).toEqual({
            workflow: "consult",
            version: "latest",
        })
        expect(subject.workflowCallOf({ workflowCall: { workflow: "consult", version: 3 } })).toEqual({
            workflow: "consult",
            version: 3,
        })
    })

    it("reads nothing from a tag that is no hand-off, or whose pin is malformed", async () => {
        const subject = await buildPolicy()
        expect(subject.workflowCallOf({})).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: "consult" })).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: [] })).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: { workflow: "", version: 1 } })).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: { workflow: 7, version: 1 } })).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: { workflow: "consult", version: 0 } })).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: { workflow: "consult", version: 1.5 } })).toBeNull()
        expect(subject.workflowCallOf({ workflowCall: { workflow: "consult", version: "newest" } })).toBeNull()
    })
})

describe("suppliedScopeOf", () => {
    it("passes a hand-off's mapped params and the caller, and nothing else of the tag", async () => {
        const subject = await buildPolicy()
        const scope = subject.suppliedScopeOf({
            members: { authorAgentId: "agent-chatbot", conversationId: "c-1" },
            payload: {
                workflowCall: { workflow: "consult", version: "latest" },
                params: { leadId: "l-1", text: "2 chau lan" },
                stray: "dropped",
                caller: { runId: "run-9" },
            },
            subject: null,
        })

        expect(scope).toEqual({
            leadId: "l-1",
            text: "2 chau lan",
            caller: { agent: "agent-chatbot", workflow: null, runId: "run-9" },
        })
    })

    it("names no caller agent or run the tag does not carry", async () => {
        const subject = await buildPolicy()
        const scope = subject.suppliedScopeOf({
            members: {},
            payload: { workflowCall: { workflow: "consult", version: 2 } },
            subject: null,
        })

        expect(scope).toEqual({ caller: { agent: null, workflow: null, runId: null } })
    })

    it("passes any other tag's plain data member by member, except where the door wrote that member", async () => {
        const subject = await buildPolicy()
        const scope = subject.suppliedScopeOf({
            members: { text: "door text" },
            payload: { careKind: "thank-you", text: "tag text", request: "10 chau" },
            subject: null,
        })

        expect(scope).toEqual({ careKind: "thank-you", request: "10 chau" })
    })

    it("supplies the transaction of a bank credit and the slot of the evening close", async () => {
        const subject = await buildPolicy()
        expect(subject.suppliedScopeOf({ members: {}, payload: {}, subject: { kind: "bank-transaction", id: "tx-1" } })).toEqual({
            transactionId: "tx-1",
        })
        expect(subject.suppliedScopeOf({ members: {}, payload: {}, subject: { kind: "order", id: "o-1" } })).toEqual({})
        expect(
            subject.suppliedScopeOf({
                members: { probeKey: "accounting_close", slot: "1700000000000" },
                payload: {},
                subject: null,
            }),
        ).toEqual({ slotMs: 1_700_000_000_000 })
        expect(
            subject.suppliedScopeOf({ members: { probeKey: "accounting_close", slot: "x" }, payload: {}, subject: null }),
        ).toEqual({})
        expect(subject.suppliedScopeOf({ members: { probeKey: "other", slot: "5" }, payload: {}, subject: null })).toEqual({})
    })
})

describe("channelOf", () => {
    it("reads the conversation's channel, else the prefix of the channel event", async () => {
        const subject = await buildPolicy()
        expect(subject.channelOf({ channel: "telegram", channelEventId: "zalo:1" })).toBe("telegram")
        expect(subject.channelOf({ channelEventId: "zalo:abc:def" })).toBe("zalo")
    })

    it("is null for a wake with neither, or an event with no prefix", async () => {
        const subject = await buildPolicy()
        expect(subject.channelOf({})).toBeNull()
        expect(subject.channelOf({ channel: "" })).toBeNull()
        expect(subject.channelOf({ channelEventId: "plain" })).toBeNull()
        expect(subject.channelOf({ channelEventId: ":x" })).toBeNull()
        expect(subject.channelOf({ channelEventId: 5 })).toBeNull()
    })
})

describe("triggerTakes", () => {
    it("takes a wake of its kind's tag source and refuses another source", async () => {
        const subject = await buildPolicy()
        expect(subject.triggerTakes(zalo("z"), "channel", {})).toBe(true)
        expect(subject.triggerTakes(zalo("z"), "schedule", {})).toBe(false)
        expect(subject.triggerTakes({ key: "w", source: { kind: "workflow", connectionId: null } }, "agent", {})).toBe(true)
    })

    it("routes by channel: a Zalo trigger refuses a Telegram wake and a Telegram trigger takes it", async () => {
        const subject = await buildPolicy()
        const telegram: WorkflowTrigger = { key: "t", source: { kind: "telegram", connectionId: null } }

        expect(subject.triggerTakes(zalo("z"), "channel", { channel: "telegram" })).toBe(false)
        expect(subject.triggerTakes(telegram, "channel", { channel: "telegram" })).toBe(true)
        expect(subject.triggerTakes(zalo("z"), "channel", { channelEventId: "zalo:99" })).toBe(true)
        expect(subject.triggerTakes(telegram, "channel", { channelEventId: "zalo:99" })).toBe(false)
    })

    it("routes by connection: one that names a connection refuses a wake on another and takes one that names none", async () => {
        const subject = await buildPolicy()
        const pinned = zalo("z", { source: { kind: "zalo", connectionId: "oa-1" } })

        expect(subject.triggerTakes(pinned, "channel", { connectionId: "oa-1" })).toBe(true)
        expect(subject.triggerTakes(pinned, "channel", { connectionId: "oa-2" })).toBe(false)
        expect(subject.triggerTakes(pinned, "channel", {})).toBe(true)
    })

    it("routes by condition: every condition must hold on the scope", async () => {
        const subject = await buildPolicy()
        const vip = zalo("z", {
            conditions: [
                { param: "text", op: "contains", value: "si" },
                { param: "leadId", op: "present" },
            ],
        })

        expect(subject.triggerTakes(vip, "channel", { text: "Mua SI nhe", leadId: "l-1" })).toBe(true)
        expect(subject.triggerTakes(vip, "channel", { text: "Mua si nhe" })).toBe(false)
        expect(subject.triggerTakes(vip, "channel", { text: "le", leadId: "l-1" })).toBe(false)
    })
})

describe("takingTriggerOf", () => {
    it("answers the key of the first trigger that takes the wake", async () => {
        const subject = await buildPolicy()
        const spec = graphOf([
            zalo("sale", { conditions: [{ param: "text", op: "equals", value: "sale" }] }),
            zalo("any"),
            { key: "tg", source: { kind: "telegram", connectionId: null } },
        ])

        expect(subject.takingTriggerOf(spec, "channel", { channel: "zalo", text: "sale" })).toBe("sale")
        expect(subject.takingTriggerOf(spec, "channel", { channel: "zalo", text: "hi" })).toBe("any")
        expect(subject.takingTriggerOf(spec, "channel", { channel: "telegram" })).toBe("tg")
    })

    it("answers null when no trigger takes it", async () => {
        const subject = await buildPolicy()
        const spec = graphOf([zalo("only", { conditions: [{ param: "text", op: "present" }] })])

        expect(subject.takingTriggerOf(spec, "channel", { channel: "zalo" })).toBeNull()
        expect(subject.takingTriggerOf(spec, "schedule", { text: "x" })).toBeNull()
    })

    it("takes a graph without typed triggers by its sources alone", async () => {
        const subject = await buildPolicy()
        const old = graphOf(undefined, ["channel"])

        expect(subject.takingTriggerOf(old, "channel", {})).toBe("")
        expect(subject.takingTriggerOf(old, "agent", {})).toBeNull()
    })
})
