import { z } from "zod"
import { graphSpecV2Schema, graphSpecV2WrittenSchema } from "../../graph/graph-spec-v2.schema"
import type { GraphSpecV2, GraphV2Step } from "../../graph/graph-spec-v2.types"
import { PROVIDER, TOOL, TRIGGER } from "../../names"
import type { ProviderKey } from "../../names"
import type { JsonValue } from "../../schema/schema.types"
import { trusted } from "../../schema/trusted"
import {
    callWorkflow,
    callWorkflows,
    endItem,
    ifNode,
    item,
    loop,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "./graph-builder"
import type { GraphStep, Ref, RefOrValue as RefOrValueOf, TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph, defineTemplateGraph, templateGraphHashV2, templateGraphText } from "./graph-compile"
import { templateGraphProblems } from "./graph-problems"
import type { TemplateGraphContext, TemplateTriggerLookup } from "./graph-problems"
import { defineTemplateAgent, templateAgentProblems } from "./template-agent"
import { defineTemplateNode, toolOk } from "./template-node"
import { TemplateDefinitionError } from "./template-problems"

/** What a definition refusal names (its `params.at`: the definition and every problem); a coded error's message is only its code. */
const refusedAt = (define: () => unknown): string => {
    try {
        define()
    } catch (error) {
        return error instanceof TemplateDefinitionError ? String(error.params["at"]) : ""
    }
    return ""
}
import type { TemplateProblem } from "./template-problems"
import {
    openToolLookup,
    parseJson,
    exampleTriggerLookup,
    listOrders,
    payRequest,
    remindCheck,
    remindNote,
    remindRecord,
    remindSend,
    roundConfig,
    roundReport,
} from "./template.fixture"

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> =>
    problems.map((problem) => `${problem.code}@${problem.at}`)

const stepOf = (spec: GraphSpecV2, key: string): GraphV2Step | undefined => spec.nodes.find((step) => step.key === key)

/** A one-node graph around a step, so each problem is judged alone. */
const single = (
    nodes: Readonly<Record<string, GraphStep>>,
    over: Partial<TemplateGraphConfig> = {},
): TemplateGraphConfig => ({
    key: "test.single",
    title: { key: "g" },
    input: z.object({ conversationId: z.string().max(200), text: z.string().max(200) }),
    triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
    start: Object.keys(nodes)[0] ?? "none",
    nodes,
    ...over,
})

describe("compileTemplateGraph: the reminder round", () => {
    const compiled = compileTemplateGraph(roundConfig)
    const spec = compiled.graph.spec

    it("compiles with no problem", () => {
        expect(codesOf(compiled.problems)).toEqual([])
    })

    it("lays the loop's body flat after its loop, each body step naming its loop", () => {
        expect(spec.nodes.map((step) => [step.key, step.kind, step.loop ?? null])).toEqual([
            ["list", "node", null],
            ["each", "loop", null],
            ["check", "node", "each"],
            ["send", "node", "each"],
            ["sent", "if", "each"],
            ["record", "node", "each"],
            ["note", "node", "each"],
            ["report", "node", null],
            ["done", "outcome", null],
        ])
        expect(stepOf(spec, "each")).toEqual({
            kind: "loop",
            key: "each",
            step: "core.loop",
            params: {
                mode: "over",
                items: { $ref: "steps.list.output.orders" },
                max: 50,
                collect: "record",
                itemKey: "orderId",
                concurrency: 5,
            },
            routes: { body: "check" },
            next: "report",
        })
    })

    it("writes a routing node's member and routes, a condition's refs with a null default, and the node's accounts", () => {
        expect(stepOf(spec, "check")).toMatchObject({ routeBy: "verdict", routes: { due: "send", later: "note" } })
        expect(stepOf(spec, "sent")).toEqual({
            kind: "if",
            key: "sent",
            loop: "each",
            step: "core.if",
            params: { when: { ref: { $ref: "steps.send.output.messageId", default: null }, op: "present" } },
            routes: { yes: "record", no: "note" },
        })
        expect(stepOf(spec, "send")).toMatchObject({
            params: { orderId: { $ref: "item.orderId" }, tone: "short" },
            model: "claude-sonnet-5-5",
            mode: "ask",
            accounts: ["zalo_oa", "telegram"],
        })
        expect(stepOf(spec, "report")).toMatchObject({ blocking: false, next: "done" })
    })

    it("derives the contract, the verb triggers and the typed outcome; writes no trigger envelope and no grant", () => {
        expect(spec.contract).toEqual({
            inputs: [
                { name: "preset", type: "string", required: true },
                { name: "leadId", type: "string", required: false },
            ],
        })
        expect(spec.triggers).toEqual([{ verb: "nivo.trigger.clock.tick", args: { preset: "daily" } }])
        expect(spec.outcomes).toEqual([{ key: "done", label: "done", outputs: [{ name: "posted", type: "boolean" }] }])
        expect(Object.keys(spec).sort()).toEqual([
            "contract",
            "entry",
            "key",
            "moduleKey",
            "nodes",
            "outcomes",
            "schema",
            "title",
            "triggers",
        ])
    })

    it("round-trips through JSON and the @2 schema, with one canonical text and hash", () => {
        const text = JSON.stringify(spec)
        const parsed = graphSpecV2Schema.parse(parseJson(text))
        expect(parsed).toEqual(spec)
        expect(templateGraphText(parsed)).toBe(templateGraphText(spec))
        expect(templateGraphHashV2(parsed)).toBe(templateGraphHashV2(compileTemplateGraph(roundConfig).graph.spec))
        expect(
            codesOf(
                templateGraphProblems(parsed, {
                    nodes: compiled.graph.nodes,
                    tools: openToolLookup,
                    triggers: exampleTriggerLookup,
                }),
            ),
        ).toEqual([])
    })

    it("the canonical text sorts object keys and keeps list order", () => {
        expect(templateGraphText(spec).startsWith('{"contract":{"inputs":[{"name":"preset"')).toBe(true)
    })
})

describe("account narrowing", () => {
    const placed = (accounts: ReadonlyArray<ProviderKey> | undefined, mode?: "auto" | "ask"): TemplateGraphConfig =>
        single({
            pay: node(payRequest, {
                input: { orderId: ref("trigger.conversationId") },
                ...(accounts === undefined ? {} : { accounts }),
                ...(mode === undefined ? {} : { mode }),
            }),
        })

    it.each<readonly [string, ReadonlyArray<ProviderKey> | undefined, ReadonlyArray<string>]>([
        ["absent: the node's own list", undefined, []],
        ["a subset of providers", [PROVIDER.sepay], []],
        ["a reorder", [PROVIDER.zaloOa, PROVIDER.casso], []],
        ["a provider the node does not have", [PROVIDER.payos], ["GRAPH_ACCOUNT_WIDER@nodes.pay.accounts.0.payos"]],
        ["a provider twice", [PROVIDER.sepay, PROVIDER.sepay], ["NODE_ACCOUNT_DUPLICATE@nodes.pay.accounts.sepay"]],
        ["none: the step acts through no provider", [], []],
    ])("%s", (_label, accounts, codes) => {
        expect(codesOf(compileTemplateGraph(placed(accounts)).problems)).toEqual(codes)
    })

    it.each<readonly [string, "auto" | "ask"]>([
        ["ask → auto (the workflow decides; nothing is wider)", "auto"],
        ["ask → ask", "ask"],
    ])("%s", (_label, mode) => {
        const compiled = compileTemplateGraph(placed(undefined, mode))
        expect(codesOf(compiled.problems)).toEqual([])
        expect(stepOf(compiled.graph.spec, "pay")).toMatchObject({ mode })
    })

    it("the engine's lookups judge ownership (a provider serving none of the node's tools) and unknown tools", () => {
        const spec = compileTemplateGraph(placed([PROVIDER.zaloOa])).graph
        const unknownSend = {
            ...openToolLookup,
            known: (tool: string) => tool !== TOOL.customerMessageSend,
            owns: () => false,
        }
        expect(codesOf(templateGraphProblems(spec.spec, { nodes: spec.nodes, tools: unknownSend }))).toEqual([
            "NODE_ACCOUNT_PROVIDER_NOT_OWNER@nodes.pay.accounts.0.zalo_oa",
            "TOOL_UNKNOWN@nodes.pay.tools.nivo.tool.customer.message.send",
        ])
        // A provider that owns one of the node's tools serves it.
        expect(codesOf(templateGraphProblems(spec.spec, { nodes: spec.nodes, tools: openToolLookup }))).toEqual([])
    })

    it("a step on `ask` whose node declares two write tools is refused (one card asks for one write)", () => {
        const spec = compileTemplateGraph(placed([PROVIDER.zaloOa])).graph
        const writes = { ...openToolLookup, writes: () => true }
        expect(codesOf(templateGraphProblems(spec.spec, { nodes: spec.nodes, tools: writes }))).toEqual([
            "NODE_ASK_WRITES_MANY@nodes.pay.tools",
        ])
    })

    it("a step on `ask` with one write and reads, or a step on `auto` with two writes, passes", () => {
        const oneWrite = { ...openToolLookup, writes: (tool: string) => tool === TOOL.customerMessageSend }
        const asked = compileTemplateGraph(placed([PROVIDER.zaloOa])).graph
        expect(codesOf(templateGraphProblems(asked.spec, { nodes: asked.nodes, tools: oneWrite }))).toEqual([])
        const auto = compileTemplateGraph(placed([PROVIDER.zaloOa], "auto")).graph
        const writes = { ...openToolLookup, writes: () => true }
        expect(codesOf(templateGraphProblems(auto.spec, { nodes: auto.nodes, tools: writes }))).toEqual([])
    })
})

describe("save problems", () => {
    const send = (wiring: Parameters<typeof node<typeof remindSend>>[1]): GraphStep => node(remindSend, wiring)
    const record = (messageId: Ref): GraphStep =>
        node(remindRecord, { input: { orderId: ref("trigger.conversationId"), messageId } })

    it.each<readonly [string, TemplateGraphConfig, ReadonlyArray<string>]>([
        [
            "a typed ref to a missing output member",
            single({
                a: send({ input: { orderId: ref("trigger.text") }, next: "b" }),
                b: record(ref("steps.a.output.messageNo")),
            }),
            ["GRAPH_REF_TYPE@nodes.b.params.messageId<-steps.a.output.messageNo"],
        ],
        [
            "a ref whose type the member cannot take",
            single({ a: node(listOrders, { next: "b" }), b: record(ref("steps.a.output.orders")) }),
            ["GRAPH_REF_TYPE@nodes.b.params.messageId<-steps.a.output.orders"],
        ],
        [
            "a ref to a trigger member the contract does not have",
            single({ a: send({ input: { orderId: ref("trigger.orderNo") } }) }),
            ["GRAPH_REF_TYPE@nodes.a.params.orderId<-trigger.orderNo"],
        ],
        [
            "a ref to a step that is not upstream",
            single({
                a: send({ input: { orderId: ref("steps.b.output.messageId") }, next: "b" }),
                b: record(ref("trigger.text")),
            }),
            ["GRAPH_REF_NOT_UPSTREAM@nodes.a.params.orderId<-steps.b.output.messageId"],
        ],
        [
            "a ref to a step that may not have run, without a default",
            single({
                a: ifNode({ when: present(ref("trigger.text")), yes: "b", no: "c" }),
                b: send({ input: { orderId: ref("trigger.text") }, next: "c" }),
                c: record(ref("steps.b.output.messageId")),
            }),
            ["GRAPH_REF_NOT_DOMINATOR@nodes.c.params.messageId<-steps.b.output.messageId"],
        ],
        [
            "an item ref outside a loop",
            single({ a: send({ input: { orderId: item("orderId") } }) }),
            ["GRAPH_REF_NOT_UPSTREAM@nodes.a.params.orderId<-item.orderId"],
        ],
        ["a required input unbound", single({ a: send({}) }), ["GRAPH_INPUT_UNBOUND@nodes.a.params.orderId"]],
        [
            "a fixed value the schema refuses",
            single({
                a: {
                    kind: "node",
                    node: remindSend,
                    input: { orderId: "o1" },
                    params: { tone: "shout" },
                    mode: null,
                    accounts: null,
                    next: null,
                    routes: null,
                },
            }),
            ["GRAPH_PARAM_INVALID@nodes.a.params.tone"],
        ],
        [
            "a route without a target",
            single({
                a: {
                    kind: "node",
                    node: remindCheck,
                    input: { orderId: ref("trigger.text") },
                    params: {},
                    mode: null,
                    accounts: null,
                    next: null,
                    routes: { due: "b" },
                },
                b: node(remindNote, { input: { orderId: "o" } }),
            }),
            ["GRAPH_ROUTE_UNTARGETED@nodes.a.routes.later"],
        ],
        [
            "a cycle",
            single({
                a: send({ input: { orderId: ref("trigger.text") }, next: "b" }),
                b: send({ input: { orderId: ref("trigger.text") }, next: "a" }),
            }),
            ["GRAPH_CYCLE@nodes"],
        ],
        [
            "a target that does not exist",
            single({ a: send({ input: { orderId: ref("trigger.text") }, next: "zz" }) }),
            ["GRAPH_TARGET_UNKNOWN@nodes.a->zz"],
        ],
        [
            "an unreachable step",
            single({
                a: send({ input: { orderId: ref("trigger.text") } }),
                b: send({ input: { orderId: ref("trigger.text") } }),
            }),
            ["GRAPH_NODE_UNREACHABLE@nodes.b"],
        ],
        [
            "a hand-off and an outcome inside a body",
            single({
                loop: loop({
                    over: ref("trigger.text"),
                    body: {
                        start: "x",
                        collect: "x",
                        nodes: {
                            x: send({ input: { orderId: item() }, next: "y" }),
                            y: callWorkflow({ agent: "sales", workflow: "consult", input: {}, next: "z" }),
                            z: outcome({ name: "won" }),
                        },
                    },
                }),
            }),
            [
                "LOOP_BODY_HANDOFF@nodes.y",
                "LOOP_BODY_HANDOFF@nodes.z",
                "GRAPH_REF_TYPE@nodes.loop.params.items<-trigger.text",
            ],
        ],
        [
            "a collect that is not a body node",
            single({
                loop: loop({
                    over: ref("steps.none.output.list", { default: [] }),
                    body: { start: "x", collect: "after", nodes: { x: send({ input: { orderId: item() } }) } },
                    next: "after",
                }),
                after: send({ input: { orderId: ref("trigger.text") } }),
            }),
            [
                "LOOP_COLLECT_UNKNOWN@nodes.loop.params.collect",
                "GRAPH_REF_NOT_UPSTREAM@nodes.loop.params.items<-steps.none.output.list",
            ],
        ],
        [
            "a body step that leaves the body",
            single({
                loop: loop({
                    over: ref("trigger.text"),
                    body: {
                        start: "x",
                        collect: "x",
                        nodes: { x: send({ input: { orderId: item() }, next: "after" }) },
                    },
                }),
                after: send({ input: { orderId: ref("trigger.text") } }),
            }),
            ["LOOP_BODY_LEAK@nodes.x->after", "GRAPH_REF_TYPE@nodes.loop.params.items<-trigger.text"],
        ],
        [
            "a malformed key",
            single({ a: send({ input: { orderId: ref("trigger.text") } }) }, { key: "Bad" }),
            ["GRAPH_KEY_MALFORMED@Bad"],
        ],
        [
            // The stored document reads an outcome key `^[a-z][a-z0-9-]{0,63}$`: an underscore made a version unreadable at save.
            "an outcome name outside the outcome-key grammar",
            single({
                a: send({ input: { orderId: ref("trigger.text") }, next: "end" }),
                end: outcome({ name: "approval_declined" }),
            }),
            ["GRAPH_OUTCOME_NAME_INVALID@nodes.end"],
        ],
        [
            "an unknown start",
            single({ a: send({ input: { orderId: ref("trigger.text") } }) }, { start: "b" }),
            ["GRAPH_START_UNKNOWN@test.single.start"],
        ],
    ])("%s", (_label, config, codes) => {
        expect(codesOf(compileTemplateGraph(config).problems)).toEqual(codes)
    })

    it("defineTemplateGraph refuses at load", () => {
        expect(() => defineTemplateGraph(single({ a: send({}) }))).toThrow(TemplateDefinitionError)
    })
})

describe("triggers", () => {
    const graph = (
        triggers: TemplateGraphConfig["triggers"],
    ): TemplateGraphContext & { readonly spec: GraphSpecV2 } => {
        const compiled = compileTemplateGraph(
            single({ a: node(remindNote, { input: { orderId: ref("trigger.conversationId") } }) }, { triggers }),
        )
        return { spec: compiled.graph.spec, nodes: compiled.graph.nodes, triggers: exampleTriggerLookup }
    }

    it.each<readonly [string, TemplateGraphConfig["triggers"], ReadonlyArray<string>]>([
        ["a customer message supplies both inputs", [trigger(TRIGGER.zaloMessageReceived)], []],
        ["a workflow call supplies what its caller maps", [trigger(TRIGGER.workflowCalled)], []],
        [
            "the clock does not supply the conversation",
            [trigger(TRIGGER.zaloMessageReceived), trigger(TRIGGER.clockTick)],
            ["TRIGGER_INPUT_MISSING@triggers.1.conversationId", "TRIGGER_INPUT_MISSING@triggers.1.text"],
        ],
        [
            "a verb the engine has no spec for",
            [trigger(TRIGGER.timerDue)],
            ["TRIGGER_UNKNOWN@triggers.0.nivo.trigger.timer.due"],
        ],
    ])("%s", (_label, triggers, codes) => {
        const context = graph(triggers)
        expect(codesOf(templateGraphProblems(context.spec, context))).toEqual(codes)
    })

    it("judges what a verb supplies for EVERY provider the trigger lists (ruling B5)", () => {
        // The engine road (no provider) is the form, which names no conversation; Zalo supplies a message; Meta serves no road.
        const perProvider: TemplateGraphContext["triggers"] = {
            supplies: (verb, provider) => {
                if (verb !== TRIGGER.zaloMessageReceived) return { kind: "unknown" }
                const text = { name: "text", type: "string" } as const
                if (provider === undefined) return { kind: "fixed", params: [{ name: "leadId", type: "string" }, text] }
                if (provider === PROVIDER.zaloOa)
                    return { kind: "fixed", params: [{ name: "conversationId", type: "integer" }, text] }
                return { kind: "unknown" }
            },
        }
        const judged = (entry: TemplateGraphConfig["triggers"]): ReadonlyArray<string> => {
            const context = { ...graph(entry), triggers: perProvider }
            return codesOf(templateGraphProblems(context.spec, context))
        }
        expect(judged([trigger(TRIGGER.zaloMessageReceived)])).toEqual([
            "TRIGGER_INPUT_MISSING@triggers.0.conversationId",
        ])
        // Ledger (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12: one source per STREAM, the trigger keeps its account list):
        // every provider the list names is judged, at `accounts.<provider>` (was `providers.<provider>`, then T1's `account.<provider>`).
        expect(judged([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa, PROVIDER.meta] })])).toEqual([
            "TRIGGER_INPUT_TYPE@triggers.0.accounts.zalo_oa.conversationId",
            "TRIGGER_UNKNOWN@triggers.0.accounts.meta",
        ])
        expect(judged([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.meta] })])).toEqual([
            "TRIGGER_UNKNOWN@triggers.0.accounts.meta",
        ])
        expect(judged([trigger(TRIGGER.timerDue, { accounts: [PROVIDER.meta] })])).toEqual([
            "TRIGGER_UNKNOWN@triggers.0.nivo.trigger.timer.due",
        ])
    })
})

describe("one trigger per purpose, one source per stream (owner key triggerOneSource2026_11_12, CORRECTED)", () => {
    const compiledOf = (triggers: TemplateGraphConfig["triggers"]) =>
        compileTemplateGraph(
            single({ a: node(remindNote, { input: { orderId: ref("trigger.conversationId") } }) }, { triggers }),
        ).graph
    /** The fixture's lookup, told which verbs are provider-backed (Zalo, Telegram, a credit) and which the engine's own (a call, the clock). */
    const carried: TemplateTriggerLookup = {
        ...exampleTriggerLookup,
        carriedBy: (verb) => {
            if (
                verb === TRIGGER.zaloMessageReceived ||
                verb === TRIGGER.telegramMessageReceived ||
                verb === TRIGGER.paymentCreditReceived
            )
                return "provider"
            if (verb === TRIGGER.workflowCalled || verb === TRIGGER.clockTick) return "engine"
            return "unknown"
        },
    }
    const judged = (
        triggers: TemplateGraphConfig["triggers"],
        lookup?: TemplateTriggerLookup,
    ): ReadonlyArray<string> => {
        const graph = compiledOf(triggers)
        return codesOf(templateGraphProblems(graph.spec, { nodes: graph.nodes, triggers: lookup }))
    }

    it("builds `accounts`, a list of providers (a package cannot know a workspace's accounts)", () => {
        expect(trigger(TRIGGER.paymentCreditReceived, { accounts: [PROVIDER.sepay, PROVIDER.casso] })).toEqual({
            verb: TRIGGER.paymentCreditReceived,
            accounts: [PROVIDER.sepay, PROVIDER.casso],
        })
        expect(trigger(TRIGGER.workflowCalled)).toEqual({ verb: TRIGGER.workflowCalled })
        expect(
            compiledOf([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })]).spec.triggers,
        ).toEqual([{ verb: TRIGGER.zaloMessageReceived, accounts: [PROVIDER.zaloOa] }])
    })

    it("refuses one verb twice, with or without the lookup (merge them into one trigger with several accounts); two purposes stay allowed", () => {
        const twice: TemplateGraphConfig["triggers"] = [
            trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] }),
            trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.telegram] }),
        ]
        expect(judged(twice)).toEqual(["TRIGGER_PURPOSE_DUPLICATE@triggers.1.nivo.trigger.zalo.message.received"])
        const anyAccount: TemplateTriggerLookup = {
            ...carried,
            supplies: (_verb, provider) =>
                exampleTriggerLookup.supplies(TRIGGER.zaloMessageReceived, provider ?? PROVIDER.zaloOa),
        }
        expect(judged(twice, anyAccount)).toEqual([
            "TRIGGER_PURPOSE_DUPLICATE@triggers.1.nivo.trigger.zalo.message.received",
        ])
        expect(
            judged([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa, PROVIDER.telegram] })]),
        ).toEqual([])
        const bothChannels: TemplateTriggerLookup = {
            ...carried,
            supplies: (_verb, provider) => exampleTriggerLookup.supplies(TRIGGER.zaloMessageReceived, provider),
        }
        expect(
            judged(
                [
                    trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] }),
                    trigger(TRIGGER.telegramMessageReceived, { accounts: [PROVIDER.telegram] }),
                ],
                bothChannels,
            ),
        ).toEqual([])
    })

    it("names each provider of the list once (TRIGGER_ACCOUNT_DUPLICATE)", () => {
        expect(
            judged([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa, PROVIDER.zaloOa] })]),
        ).toEqual(["TRIGGER_ACCOUNT_DUPLICATE@triggers.0.accounts.1.zalo_oa"])
    })

    it("a provider-backed verb needs at least one account; an engine verb takes none", () => {
        expect(judged([trigger(TRIGGER.zaloMessageReceived)], carried)).toEqual([
            "TRIGGER_ACCOUNT_MISSING@triggers.0.nivo.trigger.zalo.message.received",
        ])
        expect(judged([trigger(TRIGGER.workflowCalled, { accounts: [PROVIDER.zaloOa] })], carried)).toEqual([
            "TRIGGER_ACCOUNT_NOT_EXPECTED@triggers.0.accounts.zalo_oa",
        ])
        expect(judged([trigger(TRIGGER.workflowCalled)], carried)).toEqual([])
        // Without the lookup (a pure package compile) only the structural rules apply.
        expect(judged([trigger(TRIGGER.zaloMessageReceived)])).toEqual([])
        expect(judged([trigger(TRIGGER.workflowCalled, { accounts: [PROVIDER.zaloOa] })])).toEqual([])
    })

    it("judges the inputs against EVERY listed provider's supplies", () => {
        const perAccount: TemplateTriggerLookup = {
            ...carried,
            supplies: (verb, provider) =>
                provider === PROVIDER.telegram
                    ? { kind: "fixed", params: [{ name: "text", type: "string" }] }
                    : exampleTriggerLookup.supplies(verb, provider),
        }
        expect(judged([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })], perAccount)).toEqual([])
        expect(
            judged(
                [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa, PROVIDER.telegram] })],
                perAccount,
            ),
        ).toEqual(["TRIGGER_INPUT_MISSING@triggers.0.accounts.telegram.conversationId"])
    })

    describe("the stored forms", () => {
        const stored = (entry: Readonly<Record<string, unknown>>): unknown => ({
            ...compiledOf([trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })]).spec,
            triggers: [entry],
        })

        it("reads the old `providers` list as `accounts`, whatever its length; an empty one as none", () => {
            const two = graphSpecV2Schema.parse(
                stored({ verb: TRIGGER.paymentCreditReceived, providers: [PROVIDER.sepay, PROVIDER.casso] }),
            )
            expect(two.triggers).toEqual([
                { verb: TRIGGER.paymentCreditReceived, accounts: [PROVIDER.sepay, PROVIDER.casso] },
            ])
            expect(graphSpecV2Schema.parse(stored({ verb: TRIGGER.workflowCalled, providers: [] })).triggers).toEqual([
                { verb: TRIGGER.workflowCalled },
            ])
        })

        it("reads the one-account form (`account: x`) as `accounts: [x]`", () => {
            const read = graphSpecV2Schema.parse(
                stored({ verb: TRIGGER.zaloMessageReceived, account: PROVIDER.zaloOa }),
            )
            expect(read.triggers).toEqual([{ verb: TRIGGER.zaloMessageReceived, accounts: [PROVIDER.zaloOa] }])
        })

        it("reads `accounts` as written, and refuses a trigger naming its accounts in two forms", () => {
            const read = graphSpecV2Schema.parse(
                stored({ verb: TRIGGER.mailMessageReceived, accounts: [PROVIDER.imap] }),
            )
            expect(read.triggers).toEqual([{ verb: TRIGGER.mailMessageReceived, accounts: [PROVIDER.imap] }])
            const both = graphSpecV2Schema.safeParse(
                stored({ verb: TRIGGER.zaloMessageReceived, account: PROVIDER.zaloOa, accounts: [PROVIDER.zaloOa] }),
            )
            expect(both.success).toBe(false)
        })

        it("the written form takes `accounts` only, never empty", () => {
            const written = (entry: Readonly<Record<string, unknown>>): boolean =>
                graphSpecV2WrittenSchema.safeParse(stored(entry)).success
            expect(written({ verb: TRIGGER.zaloMessageReceived, providers: [PROVIDER.zaloOa] })).toBe(false)
            expect(written({ verb: TRIGGER.zaloMessageReceived, account: PROVIDER.zaloOa })).toBe(false)
            expect(written({ verb: TRIGGER.zaloMessageReceived, accounts: [PROVIDER.zaloOa] })).toBe(true)
            expect(written({ verb: TRIGGER.zaloMessageReceived, accounts: [] })).toBe(false)
        })
    })
})

describe("callWorkflows", () => {
    const fan = compileTemplateGraph(
        single(
            {
                sort: node(listOrders, { next: "fan" }),
                fan: callWorkflows({
                    calls: [
                        {
                            agent: "sales",
                            workflow: "quote",
                            when: ref("steps.sort.output.orders"),
                            input: { orders: ref("steps.sort.output.orders") },
                        },
                        {
                            agent: "desk",
                            workflow: "tickets",
                            version: 3,
                            when: ref("steps.sort.output.orders"),
                            input: { list: ref("steps.sort.output.orders") },
                        },
                    ],
                    next: "done",
                }),
                done: outcome({ name: "sorted" }),
            },
            { triggers: [trigger(TRIGGER.mailMessageReceived)], input: z.object({}) },
        ),
    )

    it("compiles to one presence check and one hand-off per list, each skipped when its list is empty", () => {
        expect(codesOf(fan.problems)).toEqual([])
        expect(
            fan.graph.spec.nodes
                .slice(1, 5)
                .map((step) => [
                    step.key,
                    step.kind,
                    step.kind === "if" ? step.routes : step.kind === "call-workflow" ? step.next : null,
                ]),
        ).toEqual([
            ["fan", "if", { yes: "fan-call-1", no: "fan-when-2" }],
            ["fan-call-1", "call-workflow", "fan-when-2"],
            ["fan-when-2", "if", { yes: "fan-call-2", no: "done" }],
            ["fan-call-2", "call-workflow", "done"],
        ])
        expect(stepOf(fan.graph.spec, "fan-call-2")).toMatchObject({
            params: {
                agent: "desk",
                workflow: "tickets",
                version: 3,
                inputs: { list: { $ref: "steps.sort.output.orders" } },
            },
        })
    })

    it("a fan with no next ends the run after the last list", () => {
        const open = compileTemplateGraph(
            single(
                {
                    sort: node(listOrders, { next: "fan" }),
                    fan: callWorkflows({
                        calls: [
                            { agent: "sales", workflow: "quote", when: ref("steps.sort.output.orders"), input: {} },
                        ],
                    }),
                },
                { input: z.object({}) },
            ),
        )
        expect(codesOf(open.problems)).toEqual([])
        expect(stepOf(open.graph.spec, "fan")).toMatchObject({ routes: { yes: "fan-call-1" } })
        expect(graphSpecV2Schema.safeParse(parseJson(JSON.stringify(open.graph.spec))).success).toBe(true)
    })
})

describe("defineTemplateAgent", () => {
    const round = defineTemplateGraph(roundConfig)
    const pay = defineTemplateGraph({
        ...single({ pay: node(payRequest, { input: { orderId: ref("trigger.conversationId") } }) }),
        key: "test.pay",
    })

    it("accepts graphs whose providers are the agent's", () => {
        expect(() =>
            defineTemplateAgent({
                key: "test",
                label: { key: "a" },
                accounts: [PROVIDER.sepay, PROVIDER.casso, PROVIDER.zaloOa, PROVIDER.telegram],
                graphs: [round, pay],
                primary: "test.round",
            }),
        ).not.toThrow()
    })

    it("names every provider, trigger provider and key outside the agent", () => {
        expect(
            codesOf(
                templateAgentProblems({
                    key: "test",
                    label: { key: "a" },
                    accounts: [PROVIDER.sepay, PROVIDER.sepay],
                    graphs: [pay, pay],
                    primary: "test.none",
                }),
            ),
        ).toEqual([
            "AGENT_PRIMARY_UNKNOWN@test.primary",
            "AGENT_GRAPH_DUPLICATE@test.graphs.test.pay",
            "AGENT_ACCOUNT_DUPLICATE@test.accounts.sepay",
            "NODE_ACCOUNT_NOT_OF_AGENT@test.pay:nodes.pay.accounts.1.casso",
            "NODE_ACCOUNT_NOT_OF_AGENT@test.pay:nodes.pay.accounts.2.zalo_oa",
            "TRIGGER_PROVIDER_NOT_OF_AGENT@test.pay:triggers.0.accounts.zalo_oa",
            "NODE_ACCOUNT_NOT_OF_AGENT@test.pay:nodes.pay.accounts.1.casso",
            "NODE_ACCOUNT_NOT_OF_AGENT@test.pay:nodes.pay.accounts.2.zalo_oa",
            "TRIGGER_PROVIDER_NOT_OF_AGENT@test.pay:triggers.0.accounts.zalo_oa",
        ])
    })

    it("nivo is always the agent's: a trigger provider naming it needs no listing (listing it stays legal; a node never lists it)", () => {
        const cancel = defineTemplateNode({
            id: "test.order-cancel",
            title: { key: "t" },
            description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
            tools: [TOOL.agentTag],
            mode: "ask",
            accounts: [],
            input: z.object({}),
            output: z.object({}),
            run: async (_input, ctx) => {
                await ctx.tools.call(TOOL.agentTag, {})
                return {}
            },
            examples: [
                { name: "x", params: {}, input: {}, tools: [{ id: TOOL.agentTag, answer: toolOk({}) }], output: {} },
            ],
        })
        const graph = defineTemplateGraph({
            ...single(
                { c: node(cancel) },
                { triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.nivo] })] },
            ),
            key: "test.cancel",
        })
        const agentWith = (accounts: ReadonlyArray<ProviderKey>): ReadonlyArray<string> =>
            codesOf(
                templateAgentProblems({
                    key: "test",
                    label: { key: "a" },
                    accounts,
                    graphs: [graph],
                    primary: "test.cancel",
                }),
            )
        expect(agentWith([])).toEqual([])
        expect(agentWith([PROVIDER.nivo])).toEqual([])
        expect(agentWith([PROVIDER.sepay])).toEqual([])
    })

    it("a graph of another module is outside the agent", () => {
        const other = defineTemplateGraph({
            ...single({ n: node(remindNote, { input: { orderId: "o" } }) }),
            key: "sales.note",
        })
        expect(
            codesOf(
                templateAgentProblems({
                    key: "test",
                    label: { key: "a" },
                    accounts: [PROVIDER.zaloOa],
                    graphs: [other],
                    primary: "sales.note",
                }),
            ),
        ).toEqual(["AGENT_GRAPH_OUTSIDE@test.graphs.sales.note"])
    })
})

describe("the nodes the fixture graph places", () => {
    it("are indexed by id", () => {
        expect([...compileTemplateGraph(roundConfig).graph.nodes.keys()].sort()).toEqual(
            [listOrders, remindCheck, remindSend, remindRecord, remindNote, roundReport]
                .map((entry) => entry.id)
                .sort(),
        )
    })
})

describe("an over loop body: endItem and max", () => {
    /** The reminder round with its body's ends and cap rewritten. */
    const roundWith = (
        body: Readonly<Record<string, GraphStep>>,
        cap: { readonly max?: number; readonly next?: string } = {},
        start = "check",
    ): TemplateGraphConfig => ({
        ...roundConfig,
        nodes: {
            list: node(listOrders, { next: "each" }),
            each: loop({
                over: ref("steps.list.output.orders"),
                key: "orderId",
                ...(cap.max === undefined ? {} : { max: cap.max }),
                body: { start, collect: "record", nodes: body },
                next: cap.next ?? "report",
            }),
            report: node(roundReport, { input: { items: ref("steps.each.output.items") }, next: "done" }),
            done: outcome({ name: "done", output: { posted: ref("steps.report.output.posted") } }),
        },
    })
    const record = node(remindRecord, { input: { orderId: item("orderId"), messageId: "" } })

    it("writes endItem as the route, branch or next left out, and the cap as given", () => {
        const compiled = compileTemplateGraph(
            roundWith(
                {
                    check: node(remindCheck, {
                        input: { orderId: item("orderId") },
                        routes: { due: "sent", later: endItem },
                    }),
                    sent: ifNode({ when: present(item("orderId")), yes: "record", no: endItem }),
                    record,
                },
                { max: 7 },
            ),
        )
        expect(codesOf(compiled.problems)).toEqual([])
        const spec = compiled.graph.spec
        expect(stepOf(spec, "check")).toMatchObject({ routeBy: "verdict", routes: { due: "sent" } })
        expect(stepOf(spec, "sent")).toMatchObject({ routes: { yes: "record" } })
        expect(JSON.stringify(spec)).not.toContain(endItem)
        expect(stepOf(spec, "each")).toMatchObject({ params: { max: 7 } })
        expect(graphSpecV2Schema.safeParse(spec).success).toBe(true)
        expect(templateGraphProblems(spec, { nodes: compiled.graph.nodes })).toEqual([])
    })

    it("keeps the cap at 50 when none is given", () => {
        const spec = compileTemplateGraph(roundConfig).graph.spec
        expect(stepOf(spec, "each")).toMatchObject({ params: { max: 50 } })
    })

    it("writes an if whose yes ends the item with only its no", () => {
        const spec = compileTemplateGraph(
            roundWith(
                { sent: ifNode({ when: present(item("orderId")), yes: endItem, no: "record" }), record },
                {},
                "sent",
            ),
        ).graph.spec
        expect(stepOf(spec, "sent")).toMatchObject({ routes: { no: "record" } })
        expect(graphSpecV2Schema.safeParse(spec).success).toBe(true)
    })

    it("an if with no else ends the ITEM in a body: only its yes is written", () => {
        const compiled = compileTemplateGraph(
            roundWith({ sent: ifNode({ when: present(item("orderId")), yes: "record" }), record }, {}, "sent"),
        )
        expect(codesOf(compiled.problems)).toEqual([])
        const sent = stepOf(compiled.graph.spec, "sent")
        expect(sent).toMatchObject({ routes: { yes: "record" } })
        expect(sent?.kind === "if" ? sent.routes.no : "absent").toBeUndefined()
        expect(graphSpecV2Schema.safeParse(compiled.graph.spec).success).toBe(true)
    })

    it("an if with no `no` ends the RUN outside a body: legal, only its yes is written", () => {
        const compiled = compileTemplateGraph(
            single({
                a: ifNode({ when: present(ref("trigger.text")), yes: "b" }),
                b: outcome({ name: "done" }),
            }),
        )
        expect(codesOf(compiled.problems)).toEqual([])
        const a = stepOf(compiled.graph.spec, "a")
        expect(a).toMatchObject({ kind: "if", routes: { yes: "b" } })
        expect(a?.kind === "if" ? a.routes.no : "absent").toBeUndefined()
        expect(graphSpecV2Schema.safeParse(compiled.graph.spec).success).toBe(true)
    })

    it("two outcome steps of one name must give the same outputs: the second is a GRAPH_OUTCOME_MISMATCH", () => {
        const compiled = compileTemplateGraph(
            single({
                a: ifNode({ when: present(ref("trigger.text")), yes: "b", no: "c" }),
                b: outcome({ name: "done", output: { text: ref("trigger.text") } }),
                c: outcome({ name: "done" }),
            }),
        )
        expect(codesOf(compiled.problems)).toContain("GRAPH_OUTCOME_MISMATCH@nodes.c")
        expect(codesOf(compiled.problems)).not.toContain("GRAPH_OUTCOME_MISMATCH@nodes.b")
    })

    it("an if is written with `yes` / `no`, never `then` / `else` (a `then` member makes it a thenable that `await` calls into)", async () => {
        const step = ifNode({ when: present(ref("trigger.text")), yes: "b", no: "c" })
        expect(step).toEqual({ kind: "if", when: step.when, yes: "b", no: "c" })
        expect(Object.keys(step)).not.toContain("then")
        expect(Object.keys(step)).not.toContain("else")
        // Awaited, the step is itself (a thenable would resolve to whatever its `then` called back with).
        await expect(Promise.resolve(step)).resolves.toBe(step)
        const compiled = compileTemplateGraph(
            single({ a: step, b: outcome({ name: "done" }), c: outcome({ name: "other" }) }),
        )
        expect(codesOf(compiled.problems)).toEqual([])
        expect(stepOf(compiled.graph.spec, "a")).toMatchObject({ kind: "if", routes: { yes: "b", no: "c" } })
        expect(templateGraphText(compiled.graph.spec)).not.toMatch(/"(then|else)"/)
    })

    it.each<readonly [string, TemplateGraphConfig, ReadonlyArray<string>]>([
        [
            "endItem outside a body",
            single({
                a: node(remindCheck, { input: { orderId: ref("trigger.text") }, routes: { due: "b", later: endItem } }),
                b: node(remindNote, { input: { orderId: "o" } }),
            }),
            ["GRAPH_END_ITEM_OUTSIDE@nodes.a.routes.later", "GRAPH_ROUTE_UNTARGETED@nodes.a.routes.later"],
        ],
        [
            "an if outside a body whose then ends an item",
            single({
                a: ifNode({ when: present(ref("trigger.text")), yes: endItem, no: "b" }),
                b: node(remindNote, { input: { orderId: "o" } }),
            }),
            ["GRAPH_END_ITEM_OUTSIDE@nodes.a.routes.yes", "GRAPH_ROUTE_UNTARGETED@nodes.a.routes.yes"],
        ],
        [
            "a body route that names nothing",
            roundWith({
                check: {
                    kind: "node",
                    node: remindCheck,
                    input: { orderId: item("orderId") },
                    params: {},
                    mode: null,
                    accounts: null,
                    next: null,
                    routes: { due: "record" },
                },
                record,
            }),
            ["GRAPH_ROUTE_UNTARGETED@nodes.check.routes.later"],
        ],
        [
            "a body if with an empty branch",
            roundWith({ sent: ifNode({ when: present(item("orderId")), yes: "record", no: "" }), record }, {}, "sent"),
            ["GRAPH_ROUTE_UNTARGETED@nodes.sent.routes.no", "GRAPH_TARGET_UNKNOWN@nodes.sent->"],
        ],
        ["a cap of 0", roundWith({ record }, { max: 0 }, "record"), ["LOOP_MAX_INVALID@nodes.each.params.max"]],
        ["a cap of 51", roundWith({ record }, { max: 51 }, "record"), ["LOOP_MAX_INVALID@nodes.each.params.max"]],
        [
            "a cap that is no whole number",
            roundWith({ record }, { max: 2.5 }, "record"),
            ["LOOP_MAX_INVALID@nodes.each.params.max"],
        ],
    ])("%s", (_label, config, codes) => {
        expect(codesOf(compileTemplateGraph(config).problems)).toEqual(codes)
    })

    it("refuses a stored cap past 50 at save (the schema reads it, the save judges it)", () => {
        const compiled = compileTemplateGraph(roundConfig)
        const spec = compiled.graph.spec
        const nodes = spec.nodes.map((step): GraphV2Step =>
            step.kind === "loop" && step.params.mode === "over"
                ? { ...step, params: { ...step.params, max: 51 } }
                : step,
        )
        const parsed = graphSpecV2Schema.parse({ ...spec, nodes })
        expect(codesOf(templateGraphProblems(parsed, { nodes: compiled.graph.nodes }))).toEqual([
            "LOOP_MAX_INVALID@nodes.each.params.max",
        ])
    })
})

describe("the catalogue entry", () => {
    const catalogue = {
        name: { key: "roundName" },
        summary: { vi: "Nh\u1eafc \u0111\u01a1n ch\u01b0a tr\u1ea3", en: "Reminds unpaid orders" },
        version: 3,
        publishedAt: "2026-11-12T08:00:00.000Z",
        notes: { key: "roundNotes3" },
    }

    it("travels on the @2 document, in the hash", () => {
        const plain = compileTemplateGraph(roundConfig).graph.spec
        const compiled = compileTemplateGraph({ ...roundConfig, catalogue })
        expect(codesOf(compiled.problems)).toEqual([])
        expect(compiled.graph.spec.catalogue).toEqual(catalogue)
        expect(plain.catalogue).toBeUndefined()
        expect(templateGraphHashV2(compiled.graph.spec)).not.toBe(templateGraphHashV2(plain))
        expect(graphSpecV2Schema.safeParse(compiled.graph.spec).success).toBe(true)
    })

    it("carries `seedActive` when the author sets it, and leaves it out otherwise", () => {
        const active = compileTemplateGraph({ ...roundConfig, catalogue: { ...catalogue, seedActive: true } })
        expect(codesOf(active.problems)).toEqual([])
        expect(active.graph.spec.catalogue?.seedActive).toBe(true)
        expect(graphSpecV2Schema.safeParse(active.graph.spec).success).toBe(true)
        const plain = compileTemplateGraph({ ...roundConfig, catalogue }).graph.spec.catalogue
        expect(plain === undefined ? [] : Object.keys(plain)).not.toContain("seedActive")
    })

    it.each<readonly [string, Partial<typeof catalogue>, ReadonlyArray<string>]>([
        ["a version of 0", { version: 0 }, ["GRAPH_CATALOGUE_INVALID@catalogue.version"]],
        ["a version that is no whole number", { version: 1.5 }, ["GRAPH_CATALOGUE_INVALID@catalogue.version"]],
        ["a date that is no instant", { publishedAt: "12/11/2026" }, ["GRAPH_CATALOGUE_INVALID@catalogue.publishedAt"]],
    ])("refuses %s", (_label, over, codes) => {
        expect(
            codesOf(compileTemplateGraph({ ...roundConfig, catalogue: { ...catalogue, ...over } }).problems),
        ).toEqual(codes)
    })
})

describe("GRAPH_REF_TYPE: nullability", () => {
    const findCode = defineTemplateNode({
        id: "test.code-find",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: z.object({ code: z.string().max(200).nullable(), name: z.string().max(200), note: z.string().max(200).optional() }),
        run: () => Promise.resolve({ code: null, name: "n" }),
        examples: [{ name: "x", params: {}, input: {}, output: { code: null, name: "n" } }],
    })
    const sideFind = defineTemplateNode({
        id: "test.code-side",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: z.object({ name: z.string().max(200) }),
        blocking: false,
        run: () => Promise.resolve({ name: "n" }),
        examples: [{ name: "x", params: {}, input: {}, output: { name: "n" } }],
    })
    const link = defineTemplateNode({
        id: "test.code-link",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({
            code: z.string().max(200),
            maybe: z.string().max(200).nullable().optional(),
            soft: z.string().max(200).optional(),
            nullable: z.string().max(200).nullable(),
            codes: z.array(z.string().max(200)).max(50).optional(),
        }),
        output: z.object({}),
        run: () => Promise.resolve({}),
        examples: [{ name: "x", params: {}, input: { code: "c", nullable: null }, output: {} }],
    })
    const wired = (input: Readonly<Record<string, RefOrValueOf>>, source: GraphStep = node(findCode, { next: "b" })) =>
        codesOf(
            compileTemplateGraph(single({ a: source, b: node(link, { input: { nullable: null, ...input } }) }), {
                nullability: "strict",
            }).problems,
        )

    it.each<readonly [string, Readonly<Record<string, RefOrValueOf>>, ReadonlyArray<string>]>([
        [
            "a nullable output into a non-null input, no default",
            { code: ref("steps.a.output.code") },
            ["GRAPH_REF_TYPE@nodes.b.params.code<-steps.a.output.code"],
        ],
        ["the same with a non-null default", { code: ref("steps.a.output.code", { default: "none" }) }, []],
        [
            "the same with a null default",
            { code: ref("steps.a.output.code", { default: null }) },
            ["GRAPH_REF_TYPE@nodes.b.params.code<-steps.a.output.code"],
        ],
        [
            "a nullable output into an input that admits null, null default",
            { code: "c", nullable: ref("steps.a.output.code", { default: null }) },
            [],
        ],
        [
            "a nullable output into an optional input, no default (left out)",
            { code: "c", soft: ref("steps.a.output.code") },
            [],
        ],
        [
            "an optional output member into a non-null input",
            { code: ref("steps.a.output.note") },
            ["GRAPH_REF_TYPE@nodes.b.params.code<-steps.a.output.note"],
        ],
        ["a required non-null output into a non-null input", { code: ref("steps.a.output.name") }, []],
        [
            "a nullable output inside a list, no default (null in the list)",
            { code: "c", codes: [trusted<JsonValue>(ref("steps.a.output.code"))] },
            ["GRAPH_REF_TYPE@nodes.b.params.codes.0<-steps.a.output.code"],
        ],
    ])("%s", (_label, input, codes) => {
        expect(wired(input)).toEqual(codes)
    })

    it("lenient (the compile's default) compares the JSON types only; `defineTemplateGraph` judges strictly", () => {
        const config = single({
            a: node(findCode, { next: "b" }),
            b: node(link, { input: { code: ref("steps.a.output.code"), nullable: null } }),
        })
        expect(codesOf(compileTemplateGraph(config).problems)).toEqual([])
        expect(codesOf(compileTemplateGraph(config, { nullability: "lenient" }).problems)).toEqual([])
        expect(() => defineTemplateGraph(config)).toThrow(TemplateDefinitionError)
        expect(refusedAt(() => defineTemplateGraph(config))).toContain("GRAPH_REF_TYPE")
    })

    it("a side step's output may be skipped: a non-null input needs a non-null default", () => {
        const side = node(sideFind, { next: "b" })
        expect(wired({ code: ref("steps.a.output.name") }, side)).toEqual([
            "GRAPH_REF_TYPE@nodes.b.params.code<-steps.a.output.name",
        ])
        expect(wired({ code: ref("steps.a.output.name", { default: null }) }, side)).toEqual([
            "GRAPH_REF_TYPE@nodes.b.params.code<-steps.a.output.name",
        ])
        expect(wired({ code: ref("steps.a.output.name", { default: "" }) }, side)).toEqual([])
    })
})
