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
    grant: { tools: [], effects: [] },
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
    it("passes any other tag's plain data member by member, except where the door wrote that member", async () => {
        const subject = await buildPolicy()
        const scope = subject.suppliedScopeOf({
            members: { text: "door text" },
            payload: { careKind: "thank-you", text: "tag text", request: "10 chau" },
        })

        expect(scope).toEqual({ careKind: "thank-you", request: "10 chau" })
    })

    // Ledger (TOOLS-LEAD W2): "the transaction of a bank credit" from the core road's subject left with that road (and the subject with it);
    // a bank feed's provider trigger hands `transactionId` as a member of its own plain data.
    // Ledger (TOOLS-LEAD F2): "supplies the slot of the evening close" left with the accounting module (dropped): its probe was the only
    // entry of that supply and left from the policy with it.
})

// Ledger (TOOLS-LEAD W2): `channelOf` (the channel from a channel event's prefix) left with the road-only match: the customer intake names
// the channel on the wake, and the channel's verb decides.

describe("triggerTakes", () => {
    it("takes a wake of its kind's tag source and refuses another source", async () => {
        const subject = await buildPolicy()
        expect(subject.triggerTakes(zalo("z"), "channel", { channel: "zalo" })).toBe(true)
        expect(subject.triggerTakes(zalo("z"), "schedule", {})).toBe(false)
        const call = { authorAgentId: "agent-2" }
        expect(
            subject.triggerTakes({ key: "w", source: { kind: "workflow", connectionId: null } }, "agent", call),
        ).toBe(true)
    })

    it("routes by channel: a Zalo trigger refuses a Telegram wake and a Telegram trigger takes it", async () => {
        const subject = await buildPolicy()
        const telegram: WorkflowTrigger = { key: "t", source: { kind: "telegram", connectionId: null } }

        expect(subject.triggerTakes(zalo("z"), "channel", { channel: "telegram" })).toBe(false)
        expect(subject.triggerTakes(telegram, "channel", { channel: "telegram" })).toBe(true)
        expect(subject.triggerTakes(zalo("z"), "channel", { channel: "zalo", channelEventId: "zalo:99" })).toBe(true)
        expect(subject.triggerTakes(telegram, "channel", { channel: "zalo", channelEventId: "zalo:99" })).toBe(false)
    })

    it("routes a Meta line by its channel: a Facebook trigger takes a Facebook line only, Zalo's refuses it", async () => {
        const subject = await buildPolicy()
        const facebook: WorkflowTrigger = { key: "f", source: { kind: "facebook", connectionId: null } }
        const instagram: WorkflowTrigger = { key: "i", source: { kind: "instagram", connectionId: null } }

        expect(subject.triggerTakes(facebook, "channel", { channel: "facebook" })).toBe(true)
        expect(subject.triggerTakes(instagram, "channel", { channel: "instagram" })).toBe(true)
        expect(subject.triggerTakes(facebook, "channel", { channel: "instagram" })).toBe(false)
        expect(subject.triggerTakes(zalo("z"), "channel", { channel: "facebook" })).toBe(false)
        expect(subject.triggerTakes(facebook, "schedule", { channel: "facebook" })).toBe(false)
    })

    it("routes by connection: one that names a connection takes a wake on it only, never one on another or one naming none", async () => {
        const subject = await buildPolicy()
        const pinned = zalo("z", { source: { kind: "zalo", connectionId: "oa-1" } })

        expect(subject.triggerTakes(pinned, "channel", { channel: "zalo", connectionId: "oa-1" })).toBe(true)
        expect(subject.triggerTakes(pinned, "channel", { channel: "zalo", connectionId: "oa-2" })).toBe(false)
        // Ledger (owner key triggerOneSource2026_11_12, "the others wake nothing"): a wake that names no account cannot be shown to come
        // from the one source the trigger is bound to, so it takes nothing (was: taken).
        expect(subject.triggerTakes(pinned, "channel", { channel: "zalo" })).toBe(false)
    })

    describe("one source per purpose (owner key triggerOneSource2026_11_12): two SePay accounts, the graph bound to A", () => {
        const PROVIDER_ROAD: WorkflowTrigger = {
            key: "t1-2",
            source: { kind: "provider", connectionId: "sepay-a", provider: "sepay", trigger: "transaction.received" },
            conditions: [{ param: "direction", op: "equals", value: "in" }],
        }
        const credit = (connectionId: string): Readonly<Record<string, unknown>> => ({
            providerTrigger: "sepay:transaction.received",
            connectionId,
            direction: "in",
            transactionId: "tx-1",
        })

        it("a credit on B through the provider road starts nothing; a credit on A starts it", async () => {
            const subject = await buildPolicy()
            expect(subject.triggerTakes(PROVIDER_ROAD, "system-event", credit("sepay-b"))).toBe(false)
            expect(subject.triggerTakes(PROVIDER_ROAD, "system-event", credit("sepay-a"))).toBe(true)
        })

        // Ledger (TOOLS-LEAD W2): "a core-road credit that names no account" left with the core bank road (no producer wrote it).

        it("a trigger bound to no account takes a credit of any account (readiness hides it while several could serve)", async () => {
            const subject = await buildPolicy()
            const unbound: WorkflowTrigger = {
                ...PROVIDER_ROAD,
                source: { ...PROVIDER_ROAD.source, connectionId: null },
            }
            expect(subject.triggerTakes(unbound, "system-event", credit("sepay-b"))).toBe(true)
        })
    })

    it("routes by condition: every condition must hold on the scope", async () => {
        const subject = await buildPolicy()
        const vip = zalo("z", {
            conditions: [
                { param: "text", op: "contains", value: "si" },
                { param: "leadId", op: "present" },
            ],
        })

        expect(subject.triggerTakes(vip, "channel", { channel: "zalo", text: "Mua SI nhe", leadId: "l-1" })).toBe(true)
        expect(subject.triggerTakes(vip, "channel", { channel: "zalo", text: "Mua si nhe" })).toBe(false)
        expect(subject.triggerTakes(vip, "channel", { channel: "zalo", text: "le", leadId: "l-1" })).toBe(false)
    })
})

describe("one source per stream (owner key triggerOneSource2026_11_12, CORRECTED): the binding decides whose wakes take", () => {
    const VERB = "nivo.trigger.payment.credit.received" as const
    const SEPAY_ROAD: WorkflowTrigger = {
        key: "t1-2",
        source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
        conditions: [{ param: "direction", op: "equals", value: "in" }],
    }
    const CASSO_ROAD: WorkflowTrigger = {
        key: "t1-3",
        source: { kind: "provider", connectionId: null, provider: "casso", trigger: "transaction.received" },
        conditions: [{ param: "direction", op: "equals", value: "in" }],
    }
    const graph = graphOf([SEPAY_ROAD, CASSO_ROAD], [])
    const credit = (provider: "sepay" | "casso", connectionId: string): Readonly<Record<string, unknown>> => ({
        providerTrigger: `${provider}:transaction.received`,
        connectionId,
        direction: "in",
        transactionId: "tx-1",
    })
    const stream = "bank-account:VCB:111"
    /** SePay s1 and Casso c1 read ONE bank account; the founder picked Casso. */
    const pickedCasso: policy.TriggerTakesBinding = {
        sources: [{ verb: VERB, provider: "casso", connectionId: "c1", stream }],
        muted: [{ verb: VERB, provider: "sepay", connectionId: "s1", stream }],
    }

    it("after a pick, the picked account's wake takes and the other account of the stream takes nothing", async () => {
        const subject = await buildPolicy()
        expect(subject.takingTriggerOf(graph, "system-event", credit("casso", "c1"), pickedCasso)).toBe("t1-3")
        expect(subject.takingTriggerOf(graph, "system-event", credit("sepay", "s1"), pickedCasso)).toBeNull()
    })

    // Ledger (TOOLS-LEAD W2): the two core-road cases (a credit naming no account, muted or taken by the binding) left with the core bank
    // road. The other half of the second case stays: after a pick of SePay, Casso's account of the same stream takes nothing.
    it("after a pick of SePay, Casso's account of the same stream takes nothing", async () => {
        const subject = await buildPolicy()
        const pickedSepay: policy.TriggerTakesBinding = {
            sources: [{ verb: VERB, provider: "sepay", connectionId: "s1", stream }],
            muted: [{ verb: VERB, provider: "casso", connectionId: "c1", stream }],
        }
        expect(subject.takingTriggerOf(graph, "system-event", credit("casso", "c1"), pickedSepay)).toBeNull()
        expect(subject.takingTriggerOf(graph, "system-event", credit("sepay", "s1"), pickedSepay)).toBe("t1-2")
    })

    it("accounts of different streams all take; a muted account of another verb mutes nothing here", async () => {
        const subject = await buildPolicy()
        const two: policy.TriggerTakesBinding = {
            sources: [
                { verb: VERB, provider: "sepay", connectionId: "s1", stream },
                { verb: VERB, provider: "casso", connectionId: "c1", stream: "bank-account:VCB:222" },
            ],
            muted: [{ verb: "nivo.trigger.mail.message.received", provider: "sepay", connectionId: "s1", stream: "x" }],
        }
        expect(subject.takingTriggerOf(graph, "system-event", credit("sepay", "s1"), two)).toBe("t1-2")
        expect(subject.takingTriggerOf(graph, "system-event", credit("casso", "c1"), two)).toBe("t1-3")
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

describe("triggerTakes, a generic timer (nivo.tool.timer.arm): trigger(TRIGGER.timerDue, { where: { ref } })", () => {
    const timerGraph = (ref: string): WorkflowTrigger => ({
        key: "t",
        source: { kind: "timer", connectionId: null },
        conditions: [{ param: "ref", op: "equals", value: ref }],
    })
    const due = (ref: string): Readonly<Record<string, unknown>> => ({
        source: "care-timer",
        event: "timer.due",
        ref,
        dueAt: "2026-11-14T03:00:00.000Z",
        data: { tries: 1 },
        contactId: "c-1",
    })

    it("takes the due wake of its own ref and no other graph's, whatever the data or the contact", async () => {
        const subject = await buildPolicy()
        expect(subject.triggerTakes(timerGraph("pay-check"), "system-event", due("pay-check"))).toBe(true)
        expect(subject.triggerTakes(timerGraph("pay-check"), "system-event", due("stale-check"))).toBe(false)
        expect(subject.triggerTakes(timerGraph("stale-check"), "system-event", due("pay-check"))).toBe(false)
    })

    it("hands the graph the declared members as the run's trigger scope: the ref, the data, the moment and the contact", async () => {
        const subject = await buildPolicy()
        const scope = subject.suppliedScopeOf({
            members: {},
            payload: {
                event: "timer.due",
                ref: "pay-check",
                data: { tries: 1 },
                dueAt: "2026-11-14T03:00:00.000Z",
                contactId: "c-1",
            },
        })
        expect(scope).toMatchObject({
            ref: "pay-check",
            data: { tries: 1 },
            dueAt: "2026-11-14T03:00:00.000Z",
            contactId: "c-1",
        })
    })

    it("is not taken by a graph on another verb, and a care timer's graph (careKind) takes no generic timer", async () => {
        const subject = await buildPolicy()
        const care: WorkflowTrigger = {
            key: "c",
            source: { kind: "timer", connectionId: null },
            conditions: [{ param: "careKind", op: "equals", value: "payment-reminder" }],
        }
        expect(subject.triggerTakes(care, "system-event", due("pay-check"))).toBe(false)
        expect(
            subject.triggerTakes(
                { key: "k", source: { kind: "schedule", connectionId: null } },
                "system-event",
                due("pay-check"),
            ),
        ).toBe(false)
    })

    // Ledger (TOOLS-LEAD W2): the bank-credit trigger here was the core SePay road, gone; a bank feed's provider trigger stands in, and the
    // core road's own wake (`bank_feed`) left with it.
    it("is taken by no bank-credit trigger: a timer of no graph starts nothing", async () => {
        const subject = await buildPolicy()
        const credit: WorkflowTrigger = {
            key: "t1",
            source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
        }
        expect(subject.triggerTakes(credit, "system-event", due("pay-check"))).toBe(false)
        expect(
            subject.triggerTakes(credit, "system-event", { source: "care-timer", careKind: "loyalty", ref: "order-1" }),
        ).toBe(false)
    })
})

describe("triggerTakes, several graphs of one agent keyed by a declared data field: where { data.kind }", () => {
    const kindGraph = (kind: string): WorkflowTrigger => ({
        key: "t",
        source: { kind: "timer", connectionId: null },
        conditions: [{ param: "data.kind", op: "equals", value: kind }],
    })
    const dueOf = (data?: Readonly<Record<string, string | number | boolean>>): Readonly<Record<string, unknown>> => ({
        source: "care-timer",
        event: "timer.due",
        ref: "r1",
        dueAt: "2026-11-14T03:00:00.000Z",
        ...(data === undefined ? {} : { data }),
        contactId: "c-1",
        conversationId: "v-1",
    })

    it("each graph takes the due wake of its own kind and no other", async () => {
        const subject = await buildPolicy()
        expect(
            subject.triggerTakes(kindGraph("payment-reminder"), "system-event", dueOf({ kind: "payment-reminder" })),
        ).toBe(true)
        expect(subject.triggerTakes(kindGraph("care"), "system-event", dueOf({ kind: "payment-reminder" }))).toBe(false)
        expect(subject.triggerTakes(kindGraph("care"), "system-event", dueOf({ kind: "care" }))).toBe(true)
    })

    it("a kind no graph declares starts nothing, and a wake with no such field or no data is taken by no graph that constrains it", async () => {
        const subject = await buildPolicy()
        for (const graph of [kindGraph("payment-reminder"), kindGraph("care")]) {
            expect(subject.triggerTakes(graph, "system-event", dueOf({ kind: "unknown-kind" }))).toBe(false)
            expect(subject.triggerTakes(graph, "system-event", dueOf({ stage: "x" }))).toBe(false)
            expect(subject.triggerTakes(graph, "system-event", dueOf())).toBe(false)
        }
    })

    it("the first taking trigger of a graph is found through a data path, and a ref graph still takes by its ref", async () => {
        const subject = await buildPolicy()
        const flow = { triggers: [{ ...kindGraph("care"), key: "care" }] } as unknown as Parameters<
            typeof subject.takingTriggerOf
        >[0]
        expect(subject.takingTriggerOf(flow, "system-event", dueOf({ kind: "care" }))).toBe("care")
        expect(subject.takingTriggerOf(flow, "system-event", dueOf({ kind: "x" }))).toBeNull()
        const byRef: WorkflowTrigger = {
            key: "t",
            source: { kind: "timer", connectionId: null },
            conditions: [{ param: "ref", op: "equals", value: "r1" }],
        }
        expect(subject.triggerTakes(byRef, "system-event", dueOf({ kind: "x" }))).toBe(true)
    })
})

describe("every wake carries a verb: a wake none is derived for takes no trigger (no road-only match)", () => {
    const timer: WorkflowTrigger = { key: "t", source: { kind: "timer", connectionId: null } }
    const website: WorkflowTrigger = { key: "w", source: { kind: "website", connectionId: null } }

    it("an internal wake (a plain task, an internal event) or another system's tag is taken by no trigger of its road, whatever its conditions", async () => {
        const subject = await buildPolicy()
        const task = { source: "system-event", origin: "system-event", taskId: "task-1", subjectId: "task-1" }
        const event = {
            source: "system-event",
            origin: "system-event",
            eventName: "knowledge_source.indexed",
            subjectId: "ks-1",
        }
        const foreign = { source: "booking_reminder", origin: "system-event", request: "x" }
        for (const trigger of [timer, website]) {
            expect(subject.triggerTakes(trigger, "system-event", task)).toBe(false)
            expect(subject.triggerTakes(trigger, "system-event", event)).toBe(false)
            expect(subject.triggerTakes(trigger, "system-event", foreign)).toBe(false)
        }
        expect(subject.takingTriggerOf(graphOf([timer, website], []), "system-event", task)).toBeNull()
    })

    it("a channel line that names no channel is taken by no channel trigger", async () => {
        const subject = await buildPolicy()
        expect(subject.triggerTakes(zalo("z"), "channel", { conversationId: "c-1", channelEventId: "zalo:1" })).toBe(
            false,
        )
        expect(subject.triggerTakes(zalo("z"), "channel", { conversationId: "c-1", channel: "zalo" })).toBe(true)
    })

    it("names the verb of a wake: a call names it on the one pipeline (a tag's pin is no call any more); a wake that names nothing has none", async () => {
        const subject = await buildPolicy()
        // Design moved (R30 / R24): a workflow call is delivered (`verb` on the wake); a tag wake carrying a pin is no road to a call.
        const pinned = { context: { workflowCall: { workflow: "payment", version: "latest" } } }
        expect(subject.wakeVerbOf("system-event", { verb: "nivo.trigger.workflow.called", ...pinned })).toBe(
            "nivo.trigger.workflow.called",
        )
        expect(subject.wakeVerbOf("chats-group", pinned)).toBe("nivo.trigger.chat.message.received")
        expect(subject.wakeVerbOf("agent", { authorAgentId: "agent-2" })).toBe("nivo.trigger.workflow.called")
        // The road a wake of an unknown source falls on (a generic webhook's event): no agent wrote it, so no call.
        expect(subject.wakeVerbOf("agent", { eventName: "order.created", inbound: "{}" })).toBeNull()
        expect(subject.wakeVerbOf("channel", { channel: "telegram" })).toBe("nivo.trigger.telegram.message.received")
        expect(subject.wakeVerbOf("system-event", { source: "care-timer" })).toBe("nivo.trigger.timer.due")
        expect(subject.wakeVerbOf("system-event", { source: "system-event", taskId: "task-1" })).toBeNull()
        expect(subject.wakeVerbOf("system-event", { source: "engine.workflow" })).toBeNull()
        expect(subject.wakeVerbOf("channel", { channelEventId: "zalo:1" })).toBeNull()
    })
})

describe("the verbs a graph listens to: its head triggers and its waits", () => {
    /** A graph headed by a hand-off (`workflow.called`), whose `wait` listens for a render's completion and a Zalo line, as stored. */
    const waiting: GraphSpec = {
        ...graphOf([{ key: "call", source: { kind: "workflow", connectionId: null } }], ["agent"]),
        nodes: [
            {
                key: "hold",
                kind: "condition",
                step: "core.wait",
                params: {
                    on: [
                        {
                            key: "done",
                            verb: "nivo.trigger.video.render.completed",
                            match: [
                                {
                                    member: "renderId",
                                    op: "eq",
                                    value: { $ref: "steps.start.output.renderId", default: null },
                                },
                            ],
                        },
                        { key: "said", verb: "nivo.trigger.zalo.message.received" },
                        { key: "again", verb: "nivo.trigger.video.render.completed" },
                    ],
                    timeout: { minutes: 30 },
                },
                routes: { done: "end", said: "end", again: "end", timeout: "end" },
            },
            { key: "end", kind: "output", step: "stop" },
        ],
    }

    it("reads every verb a `wait` step lists (`params.on[].verb`), each once, and none of a graph with no wait", async () => {
        const subject = await buildPolicy()
        expect(subject.waitVerbsOf(waiting)).toEqual([
            "nivo.trigger.video.render.completed",
            "nivo.trigger.zalo.message.received",
        ])
        expect(subject.waitVerbsOf(graphOf([zalo("z")]))).toEqual([])
    })

    it("listens to its head triggers' verbs and its waits' verbs, the heads first", async () => {
        const subject = await buildPolicy()
        expect(subject.listenedVerbsOf(waiting)).toEqual([
            "nivo.trigger.workflow.called",
            "nivo.trigger.video.render.completed",
            "nivo.trigger.zalo.message.received",
        ])
    })
})
