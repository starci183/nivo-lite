import { z } from "zod"
import { graphSpecV2Schema, graphSpecV2WrittenSchema } from "../../graph/graph-spec-v2.schema"
import type { GraphSpecV2, GraphV2NodeStep, Mode, NodeId } from "../../graph/graph-spec-v2.types"
import { PROVIDER, TOOL, TRIGGER } from "../../names"
import type { ProviderKey } from "../../names"
import { DomainError } from "@starci/common"

/** A spec's own refusal: the graph the case reads has no such step. */
class SpecStepError extends DomainError<"SPEC_STEP_MISSING"> {
    constructor(at: string) {
        super({ code: "SPEC_STEP_MISSING", params: { at } })
    }
}
import { node, trigger } from "./graph-builder"
import type { GraphStep, TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph } from "./graph-compile"
import { templateGraphProblems } from "./graph-problems"
import type { TemplateToolLookup } from "./graph-problems"
import { defineTemplateNode, templateNodeProblems, toolOk } from "./template-node"
import type { TemplateNodeShape } from "./template-node"
import { TemplateDefinitionError } from "./template-problems"
import type { TemplateProblem } from "./template-problems"

/*
 * Rights, one mode per node (`nivo-frame.rights`, owner 2026-11-13: "tat ca node va chuc nang la BINH DANG"): every template node DECLARES
 * its mode `auto | ask` (required, no engine default) and lists its providers in order (alternatives); a graph step may set either mode
 * and may only narrow or reorder the providers. No money class, no per-tool mode, no `never`.
 */

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> =>
    problems.map((problem) => `${problem.code}@${problem.at}`)

/** The shape the definition checks read, sound by default: one send through Zalo then Telegram, `ask`. */
const shape = (over: Partial<TemplateNodeShape>): TemplateNodeShape => ({
    id: "test.shape",
    description: { vi: "G\u1eedi tin cho kh\u00e1ch.", en: "Sends the customer a message." },
    tools: [TOOL.customerMessageSend],
    mode: "ask",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram],
    input: z.object({}),
    output: z.object({}),
    examples: [{ name: "one" }],
    ...over,
})

/** A node that sends once, through Zalo, Telegram or Meta in that order and `auto` unless `over` says otherwise. */
const sendNodeOf = (
    over: { readonly id?: NodeId; readonly mode?: Mode; readonly accounts?: ReadonlyArray<ProviderKey> } = {},
) =>
    defineTemplateNode({
        id: over.id ?? "test.send",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [TOOL.customerMessageSend],
        mode: over.mode ?? "auto",
        accounts: over.accounts ?? [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
        input: z.object({}),
        output: z.object({ sent: z.boolean() }),
        run: async (_input, ctx) => {
            const answer = await ctx.tools.call(TOOL.customerMessageSend, {})
            return { sent: answer.ok }
        },
        examples: [
            {
                name: "sends",
                params: {},
                input: {},
                tools: [{ id: TOOL.customerMessageSend, answer: toolOk({}, PROVIDER.zaloOa) }],
                output: { sent: true },
            },
            {
                name: "a person declines the send (the step's mode is ask)",
                params: {},
                input: {},
                tools: [{ id: TOOL.customerMessageSend, answer: { ok: false, refusal: "declined", facts: {} } }],
                output: { sent: false },
            },
        ],
    })

const sendNode = sendNodeOf()

/** A one-step graph around a step. */
const single = (step: GraphStep): TemplateGraphConfig => ({
    key: "test.single",
    title: { key: "g" },
    input: z.object({ conversationId: z.string().max(200), text: z.string().max(200) }),
    triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
    start: "send",
    nodes: { send: step },
})

const stepOf = (spec: GraphSpecV2): GraphV2NodeStep => {
    const found = spec.nodes.find((step): step is GraphV2NodeStep => step.kind === "node" && step.key === "send")
    if (found === undefined) throw new SpecStepError("no send step")
    return found
}

describe("a template node declares its mode", () => {
    it.each<readonly [string, Partial<TemplateNodeShape>, ReadonlyArray<string>]>([
        ["a sound node", {}, []],
        ["auto is a mode", { mode: "auto" }, []],
        ["a node of NIVO's own tools lists no provider", { accounts: [] }, []],
        ["no mode", { mode: undefined }, ["NODE_MODE_MISSING@test.shape.mode"]],
        ["a mode that is neither auto nor ask", { mode: "never" }, ["NODE_MODE_INVALID@test.shape.mode"]],
        [
            "a provider listed twice",
            { accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.zaloOa] },
            ["NODE_ACCOUNT_DUPLICATE@test.shape.accounts.zalo_oa"],
        ],
    ])("%s", (_label, over, codes) => {
        expect(codesOf(templateNodeProblems(shape(over)))).toEqual(codes)
    })

    it("a node config without a mode does not compile, and is refused at load", () => {
        expect(() =>
            // @ts-expect-error `mode` is required: a node without it does not compile.
            defineTemplateNode({
                id: "test.no-mode",
                title: { key: "t" },
                description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
                tools: [TOOL.customerMessageSend],
                accounts: [PROVIDER.zaloOa],
                input: z.object({}),
                output: z.object({}),
                run: () => Promise.resolve({}),
                examples: [{ name: "x", params: {}, input: {}, output: {} }],
            }),
        ).toThrow(TemplateDefinitionError)
    })

    it("keeps its providers in order and its mode on the definition", () => {
        expect(sendNode.accounts).toEqual([PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta])
        expect(sendNode.mode).toBe("auto")
    })
})

describe("a graph step writes one mode and its providers", () => {
    it("writes the node's mode and providers when the step says nothing", () => {
        const step = stepOf(compileTemplateGraph(single(node(sendNode))).graph.spec)
        expect(step.mode).toBe("auto")
        expect(step.accounts).toEqual([PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta])
    })

    it.each<readonly ["auto" | "ask", "auto" | "ask"]>([
        ["auto", "ask"],
        ["ask", "auto"],
    ])("a node of mode %s set to %s by the workflow: both directions are legal", (own, set) => {
        const declared = sendNodeOf({ mode: own })
        const compiled = compileTemplateGraph(single(node(declared, { mode: set })))
        expect(stepOf(compiled.graph.spec).mode).toBe(set)
        expect(codesOf(compiled.problems)).toEqual([])
    })

    it("a step may narrow and reorder the node's providers", () => {
        const compiled = compileTemplateGraph(single(node(sendNode, { accounts: [PROVIDER.meta, PROVIDER.zaloOa] })))
        expect(stepOf(compiled.graph.spec).accounts).toEqual([PROVIDER.meta, PROVIDER.zaloOa])
        expect(codesOf(compiled.problems)).toEqual([])
    })

    it("writes an empty provider list for a node of NIVO's own tools", () => {
        const own = sendNodeOf({ id: "test.own", accounts: [] })
        expect(stepOf(compileTemplateGraph(single(node(own))).graph.spec).accounts).toEqual([])
    })

    it("refuses a step provider the node does not list, and one listed twice", () => {
        const compiled = compileTemplateGraph(
            single(node(sendNode, { accounts: [PROVIDER.zaloOa, PROVIDER.smtp, PROVIDER.zaloOa] })),
        )
        expect(codesOf(compiled.problems)).toEqual([
            "NODE_ACCOUNT_DUPLICATE@nodes.send.accounts.zalo_oa",
            "GRAPH_ACCOUNT_WIDER@nodes.send.accounts.1.smtp",
        ])
    })

    it("refuses a step provider outside the agent's", () => {
        const spec = compileTemplateGraph(single(node(sendNode))).graph.spec
        const nodes = new Map([[sendNode.id, sendNode]])
        expect(
            codesOf(templateGraphProblems(spec, { nodes, agentAccounts: [PROVIDER.zaloOa, PROVIDER.meta] })),
        ).toEqual(["NODE_ACCOUNT_NOT_OF_AGENT@nodes.send.accounts.1.telegram"])
    })

    it("asks the engine whether each provider serves the node (owns one of its tools); there is no ask-only judgment", () => {
        const spec = compileTemplateGraph(single(node(sendNode))).graph.spec
        const nodes = new Map([[sendNode.id, sendNode]])
        const tools: TemplateToolLookup = {
            known: () => true,
            owns: (provider) => provider !== PROVIDER.meta,
            writes: () => true,
        }
        expect(codesOf(templateGraphProblems(spec, { nodes, tools }))).toEqual([
            "NODE_ACCOUNT_PROVIDER_NOT_OWNER@nodes.send.accounts.2.meta",
        ])
    })
})

describe("the stored step of @2", () => {
    const document = (accounts: unknown, extra: Record<string, unknown> = {}): unknown => {
        const spec = compileTemplateGraph(single(node(sendNode))).graph.spec
        const { mode: _mode, accounts: _accounts, ...rest } = stepOf(spec)
        return { ...spec, nodes: [{ ...rest, accounts, ...extra }] }
    }

    it("the written form is the mode and the providers", () => {
        const spec = compileTemplateGraph(single(node(sendNode, { mode: "ask" }))).graph.spec
        expect(graphSpecV2WrittenSchema.parse(spec)).toEqual(spec)
        const step = stepOf(spec)
        expect({ mode: step.mode, accounts: step.accounts }).toEqual({
            mode: "ask",
            accounts: ["zalo_oa", "telegram", "meta"],
        })
    })

    it("reads the old per-operation form as one mode: ask when any operation asked, the providers in order without nivo", () => {
        const old = document([
            { provider: "zalo_oa", operations: { [TOOL.customerMessageSend]: "auto" } },
            { provider: "nivo", operations: { [TOOL.contactUpdate]: "ask" } },
            { provider: "telegram", operations: { [TOOL.customerMessageSend]: "auto" } },
        ])
        const read = stepOf(graphSpecV2Schema.parse(old))
        expect({ mode: read.mode, accounts: read.accounts }).toEqual({ mode: "ask", accounts: ["zalo_oa", "telegram"] })
        expect(graphSpecV2WrittenSchema.safeParse(old).success).toBe(false)
    })

    it("reads an old step whose every operation was auto (or that listed none) as auto", () => {
        const allAuto = document([{ provider: "nivo", operations: { [TOOL.teamMessagePost]: "auto" } }])
        expect(stepOf(graphSpecV2Schema.parse(allAuto))).toMatchObject({ mode: "auto", accounts: [] })
        expect(stepOf(graphSpecV2Schema.parse(document([])))).toMatchObject({ mode: "auto", accounts: [] })
    })

    it("refuses a written step with no mode, and a step mixing the two forms", () => {
        expect(graphSpecV2WrittenSchema.safeParse(document(["zalo_oa"])).success).toBe(false)
        expect(
            graphSpecV2Schema.safeParse(
                document([{ provider: "zalo_oa", operations: { [TOOL.customerMessageSend]: "auto" } }], { mode: "auto" }),
            ).success,
        ).toBe(false)
    })
})
