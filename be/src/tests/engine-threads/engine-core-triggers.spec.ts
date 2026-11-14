import type { GraphSpec, GraphSpecV2 } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    defineTemplateGraph,
    node,
    outcome,
    sharedVerbProblems,
    templateGraphProblems,
    trigger,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { graphReadinessOf } from "@modules/domain/agent-graphs"
import { templateTriggerLookup } from "@modules/domain/agent-graphs/policies/template-lookups.policy"
import {
    triggerBindingOf,
    triggerFiringOf,
    triggerReadinessOf,
    type TriggerReadinessFacts,
} from "@modules/domain/agent-graphs/policies/trigger-readiness.policy"
import { graphOfSpecV2 } from "@modules/domain/installed-plugins"
import { checkNode } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { z } from "zod"

// ENGINE CORE: TRIGGERS (frame `nivo-frame.triggers`: a graph declares an ARRAY of triggers; a purpose once per graph; ONE SOURCE PER
// STREAM; the same verb on two graphs of one agent only with exactly disjoint `where`; a graph none of whose triggers can fire is hidden),
// on SMALL GENERIC GRAPHS of the generic fixture's check node, judged by the engine's own pure functions as the router, the trigger takers
// and the agent page read them (`triggerBindingOf`, `triggerFiringOf`, `graphReadinessOf`) and by the SDK's save checks
// (`templateGraphProblems`, `sharedVerbProblems`) with the engine's trigger lookup. The provider-backed verb is the core mail road
// (`mail.message.received` on IMAP): core provider plumbing, no business. The wake dedupe (one event = one run) is NOT proved here: the
// world's wake table is a fake (`thread-world-process.ts` `workProvidersOf`); see the report.


/** A generic graph: one check step of the fixture, woken by `triggers`. */
const graphOf = (key: string, triggers: Parameters<typeof defineTemplateGraph>[0]["triggers"]): TemplateGraph =>
    defineTemplateGraph({
        key,
        title: { vi: key, en: key },
        input: z.object({}),
        triggers,
        openTo: "any",
        start: "check",
        nodes: { check: node(checkNode, { input: { noteId: "n1" }, next: "done" }), done: outcome({ name: "done" }) },
    })

/** The mailbox graph: woken by a mail on any attached IMAP account (each one source per mailbox). */
const mailGraph = graphOf("tcore.mail", [trigger(TRIGGER.mailMessageReceived, { accounts: [PROVIDER.imap] })])

/** The clock graph: woken by the engine's own road (no account). */
const clockGraph = graphOf("tcore.clock", [trigger(TRIGGER.clockTick, { args: { every: "1h" } })])

const lookups = { legacyNodeOf: () => undefined, templateNodeOf: (id: string) => (id === checkNode.id ? checkNode : undefined) }

/** The graph as the engine reads it (`nivo/agent-graph@1`, its typed triggers). */
const engineOf = (graph: TemplateGraph): GraphSpec => graphOfSpecV2(graph.spec, lookups)

/** Two attached mailboxes and their public facts (the stream each reads is its address). */
const mailboxes = (first: string, second: string): TriggerReadinessFacts => ({
    attachments: [
        { provider: PROVIDER.imap, connectionId: "imap-1" },
        { provider: PROVIDER.imap, connectionId: "imap-2" },
    ],
    publicFacts: new Map([
        ["imap-1", { email: first }],
        ["imap-2", { email: second }],
    ]),
    switches: new Map([
        ["imap-1", [{ triggerName: "mail.received", enabled: true }]],
        ["imap-2", [{ triggerName: "mail.received", enabled: true }]],
    ]),
})

/** The readiness of a graph over the facts, as the router reads it (node side + trigger side). */
const readinessOf = (graph: GraphSpec, facts: TriggerReadinessFacts) =>
    graphReadinessOf(graph, { attachments: facts.attachments, triggers: triggerReadinessOf(triggerFiringOf(graph, facts)) })

describe("one source per stream", () => {
    it("two accounts on DIFFERENT streams both wake the graph: two sources, nothing contested, the graph shows", () => {
        const graph = engineOf(mailGraph)
        const facts = mailboxes("cto@shop.vn", "ketoan@shop.vn")

        const binding = triggerBindingOf(graph, facts)
        expect(binding.sources.map((one) => [one.connectionId, one.stream])).toEqual([
            ["imap-1", "mailbox:cto@shop.vn"],
            ["imap-2", "mailbox:ketoan@shop.vn"],
        ])
        expect(binding.contested).toEqual([])
        expect(readinessOf(graph, facts)).toMatchObject({ hidden: false })
    })

    it("two accounts on the SAME stream with no pick: `needs_pick`, the graph is hidden (the engine never picks)", () => {
        const graph = engineOf(mailGraph)
        // The same mailbox read by two connections (the canonical form: case and blanks do not tell them apart).
        const facts = mailboxes("ketoan@shop.vn", " KeToan@Shop.vn ")

        expect(triggerBindingOf(graph, facts).sources).toEqual([])
        expect(triggerFiringOf(graph, facts)).toEqual({
            canFire: false,
            blocked: [{ provider: PROVIDER.imap, verb: TRIGGER.mailMessageReceived, reason: "needs_pick", stream: "mailbox:ketoan@shop.vn", connectionIds: ["imap-1", "imap-2"] }],
        })
        expect(readinessOf(graph, facts)).toMatchObject({ hidden: true, waitingFor: [PROVIDER.imap] })
    })

    it("after the founder's pick ONE account wakes it: the other is muted, the graph shows", () => {
        const graph = engineOf(mailGraph)
        const facts: TriggerReadinessFacts = {
            ...mailboxes("ketoan@shop.vn", "ketoan@shop.vn"),
            picks: [{ verb: TRIGGER.mailMessageReceived, stream: "mailbox:ketoan@shop.vn", connectionId: "imap-2" }],
        }

        const binding = triggerBindingOf(graph, facts)
        expect(binding.sources.map((one) => one.connectionId)).toEqual(["imap-2"])
        expect(binding.muted.map((one) => one.connectionId)).toEqual(["imap-1"])
        expect(readinessOf(graph, facts)).toMatchObject({ hidden: false })
    })
})

describe("a graph none of whose triggers can fire is hidden", () => {
    it("no mailbox attached: `not_connected`, hidden; its trigger switched off: `trigger_off`, hidden", () => {
        const graph = engineOf(mailGraph)

        expect(readinessOf(graph, { attachments: [] })).toMatchObject({
            hidden: true,
            blocked: [{ provider: PROVIDER.imap, verb: TRIGGER.mailMessageReceived, reason: "not_connected" }],
        })
        const off: TriggerReadinessFacts = {
            attachments: [{ provider: PROVIDER.imap, connectionId: "imap-1" }],
            switches: new Map([["imap-1", [{ triggerName: "mail.received", enabled: false }]]]),
        }
        expect(readinessOf(graph, off)).toMatchObject({ hidden: true, blocked: [{ provider: PROVIDER.imap, verb: TRIGGER.mailMessageReceived, reason: "trigger_off" }] })
    })

    it("a verb of the engine's own road (clock.tick) needs no account: it always fires", () => {
        const graph = engineOf(clockGraph)

        expect(triggerFiringOf(graph, { attachments: [] })).toEqual({ canFire: true })
        expect(readinessOf(graph, { attachments: [] })).toMatchObject({ hidden: false })
    })
})

describe("the save checks of triggers, with the engine's trigger lookup", () => {
    it("a purpose appears once per graph: the same verb twice is refused (TRIGGER_PURPOSE_DUPLICATE)", () => {
        const [only] = mailGraph.spec.triggers
        const twice = { ...mailGraph.spec, triggers: [only, only] } as unknown as GraphSpecV2

        expect(templateGraphProblems(mailGraph.spec, { nodes: mailGraph.nodes, triggers: templateTriggerLookup })).toEqual([])
        expect(templateGraphProblems(twice, { nodes: mailGraph.nodes }).map((one) => one.code)).toContain("TRIGGER_PURPOSE_DUPLICATE")
    })

    it("the same verb on two graphs of one agent: refused with no `where`, taken with exactly disjoint `where`", () => {
        const bare: readonly [TemplateGraph, ...Array<TemplateGraph>] = [mailGraph, graphOf("tcore.mail-2", [trigger(TRIGGER.mailMessageReceived, { accounts: [PROVIDER.imap] })])]
        expect(sharedVerbProblems({ key: "tcore", graphs: bare }).map((one) => one.code)).toEqual([
            "TRIGGER_VERB_SHARED",
            "TRIGGER_VERB_SHARED",
        ])

        const keyed = (key: string, mailbox: string) =>
            graphOf(key, [
                trigger(TRIGGER.mailMessageReceived, { accounts: [PROVIDER.imap], where: [{ param: "mailbox", op: "equals", value: mailbox }] }),
            ])
        const disjoint: readonly [TemplateGraph, ...Array<TemplateGraph>] = [keyed("tcore.cto", "cto@shop.vn"), keyed("tcore.ketoan", "ketoan@shop.vn")]
        expect(sharedVerbProblems({ key: "tcore", graphs: disjoint })).toEqual([])
        const overlapping: readonly [TemplateGraph, ...Array<TemplateGraph>] = [keyed("tcore.cto", "cto@shop.vn"), keyed("tcore.cto-2", "cto@shop.vn")]
        expect(sharedVerbProblems({ key: "tcore", graphs: overlapping }).map((one) => one.code)).toContain("TRIGGER_VERB_SHARED")
    })

    it("a pinned verb (workflow.called) may sit on several graphs of one agent", () => {
        const called = (key: string) => graphOf(key, [trigger(TRIGGER.workflowCalled)])

        expect(sharedVerbProblems({ key: "tcore", graphs: [called("tcore.a"), called("tcore.b")] })).toEqual([])
    })
})

