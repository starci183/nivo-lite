import { z } from "zod"
import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS, TOOL } from "../names"
import type { JsonObject } from "../schema/schema.types"
import { checkTemplateNode } from "../template/builder/template-example"
import { defineTemplateNode, toolOk } from "../template/builder/template-node"
import type { TurnRef } from "./node.types"
import { runTemplateNode, type TemplateHostPorts, type TemplateNodeRunRequest } from "./template-host"
import { ToolUndeclaredError } from "./tool-undeclared-error"

// The two default tool sets (owner): a node never lists the record and file tools (`DEFAULT_NODE_TOOLS`), and every AI step holds the
// read-context tools (`DEFAULT_AI_READ_TOOLS`). `tools` lists only the tools that act outside.

interface Seen {
    readonly id: string
    readonly args: JsonObject
}

const TURN: TurnRef = { turnId: "turn-1", workspaceId: "ws-1", agentId: "agent-1", subject: null }

const portsOf = (turns: ReadonlyArray<unknown>) => {
    const seen: Array<Seen> = []
    const asked: Array<unknown> = []
    let next = 0
    const ports: TemplateHostPorts = {
        callTool: (id, args) => {
            seen.push({ id, args })
            return Promise.resolve({ ok: true })
        },
        model: {
            text: () => Promise.reject(new Error("no text")),
            json: (schema, request) => {
                asked.push(request)
                const turn = turns[next]
                next += 1
                return Promise.resolve(schema.parse(turn))
            },
        },
        now: () => new Date("2026-01-05T02:00:00.000Z"),
    }
    return { ports, seen, asked }
}

const requestOf = (node: TemplateNodeRunRequest["node"]): TemplateNodeRunRequest => ({
    node,
    params: {},
    input: {},
    turn: TURN,
    run: { id: "run-1", at: "2026-01-05T09:00:00.000+07:00", day: "2026-01-05", item: null, queue: [], waiting: 0 },
    workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
    key: "run-1:step",
    tools: new Map(),
    effects: new Map(),
})

/** An AI step of a node that lists ONE outside tool (the customer send), asked with or without a subset. */
const aiStep = (subset: ReadonlyArray<typeof TOOL.customerMessageSend> | undefined) =>
    defineTemplateNode({
        id: "test.ai",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [TOOL.customerMessageSend],
        mode: "auto",
        accounts: [],
        model: "claude-sonnet-5-5",
        input: z.object({}),
        output: z.object({ done: z.boolean() }),
        run: (_input, ctx) =>
            ctx.agent.run({
                goal: "Look the answer up and note it.",
                input: {},
                output: z.object({ done: z.boolean() }),
                ...(subset === undefined ? {} : { tools: subset }),
            }),
        examples: [{ name: "x", params: {}, input: {}, output: { done: true }, agent: [{ answer: { done: true } }] }],
    })

/** A node whose CODE calls one tool it does not list. */
const codeCalling = (id: typeof TOOL.recordCreate | typeof TOOL.brainSearch) =>
    defineTemplateNode({
        id: "test.code",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: z.object({ ok: z.boolean() }),
        run: async (_input, ctx) => {
            const answer = await ctx.tools.call(id, { type: "x.y", values: {}, query: "q" })
            return { ok: answer.ok }
        },
        examples: [{ name: "x", params: {}, input: {}, output: { ok: true }, tools: [{ id, answer: toolOk({}) }] }],
    })

describe("default tools: never listed, always held", () => {
    it("the two sets are disjoint, and no read-context tool writes a record", () => {
        expect(DEFAULT_AI_READ_TOOLS.filter((id) => DEFAULT_NODE_TOOLS.includes(id))).toEqual([])
        expect(DEFAULT_AI_READ_TOOLS).toEqual(expect.arrayContaining([TOOL.brainSearch, TOOL.conversationMessageList, TOOL.contactGet]))
        expect(DEFAULT_NODE_TOOLS).toEqual(expect.arrayContaining([TOOL.recordCreate, TOOL.recordUpdate, TOOL.filePut]))
    })

    it("an AI step calls an UNLISTED read-context tool and an unlisted record tool: both go through the door", async () => {
        const { ports, seen } = portsOf([
            { call: { tool: TOOL.brainSearch, args: { query: "gi\u00e1 hoa h\u1ed3ng" } } },
            { call: { tool: TOOL.recordCreate, args: { type: "sales.order", values: {} } } },
            { done: { done: true } },
        ])
        const ran = await runTemplateNode(requestOf(aiStep(undefined)), ports)
        expect(ran.output).toEqual({ done: true })
        expect(seen.map((call) => call.id)).toEqual([TOOL.brainSearch, TOOL.recordCreate])
    })

    it("a subset that names no tool still offers every default (read tools and record tools always)", async () => {
        const { ports, seen, asked } = portsOf([
            { call: { tool: TOOL.contactGet, args: {} } },
            { call: { tool: TOOL.customerMessageSend, args: { text: "x" } } },
            { done: { done: true } },
        ])
        await runTemplateNode(requestOf(aiStep([])), ports)
        // The default read ran; the listed outside tool was left out of the subset, so it was refused to the model, never made.
        expect(seen.map((call) => call.id)).toEqual([TOOL.contactGet])
        expect(JSON.stringify(asked.at(-1))).toContain("TOOL_NOT_OFFERED")
    })

    it("the step shown to the model lists every default beside the node's own tools", async () => {
        const { ports, asked } = portsOf([{ done: { done: true } }])
        await runTemplateNode(requestOf(aiStep(undefined)), ports)
        const shown = JSON.stringify(asked[0])
        for (const id of [...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS, TOOL.customerMessageSend]) expect(shown).toContain(id)
    })

    it("an AI step's call of an unlisted OUTSIDE tool is still refused to the model, never made", async () => {
        const { ports, seen, asked } = portsOf([
            { call: { tool: TOOL.mailMessageSend, args: { to: "a@b.c" } } },
            { done: { done: true } },
        ])
        await runTemplateNode(requestOf(aiStep(undefined)), ports)
        expect(seen).toEqual([])
        expect(JSON.stringify(asked.at(-1))).toContain("TOOL_NOT_OFFERED")
    })

    it("a node's CODE calls an unlisted record tool; an unlisted read-context tool is the AI step's only (TOOL_UNDECLARED)", async () => {
        const record = portsOf([])
        await expect(runTemplateNode(requestOf(codeCalling(TOOL.recordCreate)), record.ports)).resolves.toMatchObject({
            output: { ok: true },
        })
        expect(record.seen.map((call) => call.id)).toEqual([TOOL.recordCreate])
        const read = portsOf([])
        await expect(runTemplateNode(requestOf(codeCalling(TOOL.brainSearch)), read.ports)).rejects.toBeInstanceOf(ToolUndeclaredError)
        expect(read.seen).toEqual([])
    })
})

describe("default tools in the example runner (checkTemplateNode)", () => {
    it("an example whose agent turn calls unlisted defaults, and whose code calls an unlisted record tool, holds", async () => {
        const node = defineTemplateNode({
            id: "test.both",
            title: { key: "t" },
            description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
            tools: [],
            mode: "ask",
            accounts: [],
            model: "claude-sonnet-5-5",
            input: z.object({}),
            output: z.object({ ok: z.boolean() }),
            run: async (_input, ctx) => {
                await ctx.agent.run({ goal: "g", input: {}, output: z.object({}), tools: [] })
                const made = await ctx.tools.call(TOOL.recordUpdate, { type: "x.y", id: "1", values: {} })
                return { ok: made.ok }
            },
            examples: [
                {
                    name: "defaults",
                    params: {},
                    input: {},
                    agent: [
                        {
                            answer: {},
                            calls: [
                                { id: TOOL.brainPassageSearch, answer: toolOk({}) },
                                { id: TOOL.recordCreate, answer: toolOk({}) },
                            ],
                        },
                    ],
                    tools: [{ id: TOOL.recordUpdate, answer: toolOk({}) }],
                    output: { ok: true },
                },
            ],
        })
        expect(await checkTemplateNode(node)).toEqual([])
    })

    it("an example whose CODE calls an unlisted read-context tool is broken", async () => {
        const lines = await checkTemplateNode(codeCalling(TOOL.brainSearch))
        expect(lines.join("\n")).toContain("is not in the node's tools")
    })
})
