import { AIMessage, type BaseMessage } from "@langchain/core/messages"
import { Test } from "@nestjs/testing"
import { defineEffect, defineNode, isNodeConfused, runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeAgentLoop, NodeHostPorts, TurnRef } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, type FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { fakeModel } from "langchain"
import { z } from "zod"
import { LanggraphError, LanggraphErrorCode } from "../errors/langgraph.error"
import { AgentLoopClient, stepAgentOf } from "./agent-loop.client"
import type { AgentLoopModel } from "./agent-loop.port"
import { CONFUSED_TOOL, DONE_TOOL } from "./loop-frame.policy"
import { STEP_MIDDLEWARE } from "./step-middleware.adapter"
import { isRecord } from "./turn-answer.mapper"

/** The arguments of a scripted call. */
type Args = Readonly<Record<string, unknown>>

/** One call in the shape the SDK's fake scripts. */
interface SdkCall {
    readonly tool: string
    readonly args: Args
}

/** One model turn in the shape the SDK's fake scripts: the very script its own loop is driven by. */
type SdkTurn = { readonly call: SdkCall } | { readonly done: unknown } | { readonly confused: Args }

/** One native tool call. */
interface NativeCall {
    readonly name: string
    readonly args: Args
}

/** The native tool call a scripted turn is: a tool of the agent, `done` with the output, or `confused`. */
const nativeOf = (turn: SdkTurn): NativeCall => {
    if ("call" in turn) return { name: turn.call.tool, args: turn.call.args }
    if ("done" in turn) return { name: DONE_TOOL, args: { output: turn.done } }
    return { name: CONFUSED_TOOL, args: turn.confused }
}

/** What one request of the model was bound with. */
interface Bound {
    readonly tools: ReadonlyArray<unknown>
    readonly options: Args
}

/** A scripted chat model with what it was asked. */
interface ScriptedModel {
    readonly model: AgentLoopModel
    readonly chat: ReturnType<typeof fakeModel>
    readonly bound: ReadonlyArray<Bound>
    readonly turns: () => number
}

/**
 * A scripted chat model: one answer per model call, in order, each one native tool call; a call past the script throws. It records
 * the messages of every call and the tools and settings each request was bound with. No network.
 */
const scriptedModel = (script: ReadonlyArray<SdkTurn>, extra: Partial<AgentLoopModel> = {}): ScriptedModel => {
    const chat = fakeModel()
    const bound: Array<Bound> = []
    const bind = chat.bindTools.bind(chat)
    Object.assign(chat, {
        bindTools: (tools: Parameters<typeof bind>[0], options: Args = {}) => {
            bound.push({ tools, options })
            return bind(tools)
        },
    })
    script.forEach((turn, at) => {
        chat.respond(new AIMessage({ content: "", tool_calls: [{ type: "tool_call", id: `call-${at + 1}`, ...nativeOf(turn) }] }))
    })
    const count = { turns: 0 }
    const model: AgentLoopModel = {
        toolChoice: "auto",
        model: chat,
        turn: (attempt) => {
            count.turns += 1
            return attempt(chat, 1)
        },
        ...extra,
    }
    return { model, chat, bound, turns: () => count.turns }
}

/** The messages one model call was sent, as kind and text. */
const sentOf = (messages: ReadonlyArray<BaseMessage>): ReadonlyArray<readonly [string, string]> =>
    messages.map((message) => [message.type, message.text] as const)

/** The names of a tool list, in order. */
const namesOf = (tools: ReadonlyArray<unknown>): ReadonlyArray<string> =>
    tools.map((tool) => (isRecord(tool) && isRecord(tool.function) ? String(tool.function.name) : "?"))

/** The loop, built the way Nest builds it. */
const build = async (): Promise<AgentLoopClient> => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentLoopClient] }).compile()
    return moduleRef.get(AgentLoopClient)
}

const markPaid = defineEffect({
    id: "nivo.tool.payment.order.settle",
    title: { key: "t" },
    payload: z.object({ orderId: z.string().max(40), transactionId: z.string().max(40) }),
})
const tellTeam = defineEffect({
    id: "agent-message.post",
    title: { key: "t" },
    payload: z.object({ text: z.string().max(200) }),
})
const OUTPUT = z.object({ result: z.enum(["paid", "not-paid"]), orderId: z.string().max(40) })
const TOLD = z.object({ told: z.boolean() })

const PAY = { call: { tool: "nivo.tool.payment.order.settle", args: { orderId: "o-1", transactionId: "tx-1" } } }
const TELL = { call: { tool: "agent-message.post", args: { text: "Money received" } } }
const DONE = { done: { result: "paid", orderId: "o-1" } }
const STUCK = { confused: { reason: "The order is closed", question: "What to do with the surplus?" } }

/** The step of the SDK's own agent-run spec: a goal, two tools, one required. */
const settleNode = defineNode({
    id: "payment.settle",
    role: "output",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ orderId: z.string().max(40), transactionId: z.string().max(40) }),
    output: OUTPUT,
    effects: ["nivo.tool.payment.order.settle", "agent-message.post"],
    requires: ["nivo.tool.payment.order.settle"],
    run: async (input, context) => {
        const decision = await context.agent.run({
            goal: "Mark the order paid with the bank transaction, then tell the team.",
            input,
            output: OUTPUT,
            maxTurns: 4,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "marks the order paid",
            params: {},
            input: { orderId: "o-1", transactionId: "tx-1" },
            output: { result: "paid", orderId: "o-1" },
            effects: ["nivo.tool.payment.order.settle"],
            model: [PAY, DONE],
        },
    ],
})

/** Another step of the same agent: another goal, other tools, another output. */
const tellNode = defineNode({
    id: "payment.tell",
    role: "output",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ orderId: z.string().max(40) }),
    output: TOLD,
    effects: ["agent-message.post"],
    run: async (input, context) => {
        const decision = await context.agent.run({ goal: "Tell the team the order is paid.", input, output: TOLD })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "tells the team",
            params: {},
            input: { orderId: "o-1" },
            output: { told: true },
            effects: ["agent-message.post"],
            model: [TELL, { done: { told: true } }],
        },
    ],
})

/** A turn of an agent that holds both tools, whichever step runs. */
const AGENT_TURN: TurnRef = { ...EXAMPLE_TURN, agentTools: ["nivo.tool.payment.order.settle", "agent-message.post"] }

/** What a script is run with: the model's turns and what each effect answers. */
type Script = Pick<FakeNodePortsOptions, "answers"> & { readonly model: ReadonlyArray<SdkTurn> }

/** One run of a node and what it left behind. */
interface Ran {
    readonly ran: ReturnType<typeof runNode>
    readonly fake: ReturnType<typeof fakeNodePorts>
    readonly loops: ReadonlyArray<NodeAgentLoop>
    readonly scripted: ScriptedModel
}

/**
 * Runs a node on the script: over the runner's own JSON loop (`client` absent), or with `ports.agent` bound to the loop under test
 * and the same script turned into native tool calls.
 */
const run = (
    script: Script,
    client?: AgentLoopClient,
    node: typeof settleNode | typeof tellNode = settleNode,
    clientKind?: string,
): Ran => {
    const scripted = scriptedModel(script.model)
    // The kind of client the agent is built over, as `_llmType()` names it (`anthropic` for the Messages route's client).
    if (clientKind !== undefined) Object.assign(scripted.chat, { _llmType: () => clientKind })
    const fake = fakeNodePorts({ answers: script.answers, model: client === undefined ? script.model : [] })
    const loops: Array<NodeAgentLoop> = []
    const bound: Pick<NodeHostPorts, "agent"> =
        client === undefined
            ? {}
            : {
                  agent: (loop) => {
                      loops.push(loop)
                      return client.run(loop, scripted.model)
                  },
              }
    const ran = runNode(
        {
            node,
            params: {},
            input: node === settleNode ? { orderId: "o-1", transactionId: "tx-1" } : { orderId: "o-1" },
            turn: AGENT_TURN,
            grant: { },
            effects: new Map([markPaid, tellTeam].map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: `run-1:${node.id}`,
        },
        { ...fake.ports, ...bound },
    )
    return { ran, fake, loops, scripted }
}

/** What a run came to, in a shape two loops can be compared by. */
const outcomeOf = async ({ ran, fake }: Ran): Promise<unknown> => ({
    end: await ran.then(
        (done) => ({ output: done.output, effects: done.effects }),
        (thrown: unknown) => (isNodeConfused(thrown) ? { confused: thrown.confusion } : { failed: String(thrown) }),
    ),
    executed: fake.executed,
})

describe("AgentLoopClient: the same end as the runner's own loop, on the SDK's eight scripts", () => {
    const SCRIPTS: ReadonlyArray<readonly [string, Script]> = [
        ["calls, then the output", { model: [PAY, TELL, DONE] }],
        ["an early output refused until the required call succeeded", { model: [DONE, PAY, DONE] }],
        ["an output that does not fit, then one that does", { model: [PAY, { done: { result: "maybe" } }, DONE] }],
        ["a tool the step does not declare, then the call", { model: [{ call: { tool: "nivo.tool.order.create", args: {} } }, PAY, DONE] }],
        ["a confusion", { model: [PAY, STUCK] }],
        [
            "a refusal that satisfies nothing, then a confusion",
            { model: [PAY, DONE, STUCK], answers: { "nivo.tool.payment.order.settle": [{ kind: "refused", id: "needs_owner_note" }] } },
        ],
        [
            "a send already told for the stop counts as done",
            { model: [PAY, DONE], answers: { "nivo.tool.payment.order.settle": [{ kind: "refused", id: "already_told_for_this_stop" }] } },
        ],
        ["turns run out", { model: [TELL, TELL, TELL, TELL] }],
    ]

    it.each(SCRIPTS)("%s", async (_what, script) => {
        const hosted = run(script, await build())

        const own = await outcomeOf(run(script))
        const host = await outcomeOf(hosted)

        expect(host).toEqual(own)
        // One model call per scripted turn, each through the model side's `turn`: the loop asks nothing by itself.
        expect(hosted.scripted.chat.callCount).toBe(script.model.length)
        expect(hosted.scripted.turns()).toBe(script.model.length)
    })

    it("relays the runner's refusal of an early `done` as the tool message the model reads on its next turn", async () => {
        const { ran, scripted } = run({ model: [DONE, PAY, DONE] }, await build())
        await ran

        const second = scripted.chat.calls[1]?.messages ?? []
        expect(sentOf(second).at(-1)).toEqual([
            "tool",
            JSON.stringify({ ok: false, refused: { code: "REQUIRED_CALL_MISSING", message: "nivo.tool.payment.order.settle" } }),
        ])
        // The list only grows: what the first call was sent is the opening of what the second was sent.
        expect(sentOf(second).slice(0, 2)).toEqual(sentOf(scripted.chat.calls[0]?.messages ?? []))
    })

    it("returns a tool's own refusal as tool content, with its true values, and the model's next turn sees it", async () => {
        const refused = { kind: "refused", id: "needs_owner_note", facts: { amountVnd: 5_000_000 } }
        const { ran, scripted } = run({ model: [PAY, STUCK], answers: { "nivo.tool.payment.order.settle": [refused] } }, await build())
        await ran.then(
            () => null,
            (thrown: unknown) => thrown,
        )

        const [kind, content] = sentOf(scripted.chat.calls[1]?.messages ?? []).at(-1) ?? ["", ""]
        expect(kind).toBe("tool")
        expect(content).toContain('{"ok":false,"refused":{"code":"needs_owner_note"')
        expect(content).toContain('"data":{"amountVnd":5000000}')
    })

    it("ends on `confused` with the question, and asks the model nothing more", async () => {
        const { ran, scripted } = run({ model: [PAY, STUCK, DONE] }, await build())

        const cause = await ran.then(
            () => null,
            (thrown: unknown) => thrown,
        )

        expect(isNodeConfused(cause) ? cause.confusion : null).toEqual(STUCK.confused)
        expect(scripted.chat.callCount).toBe(2)
    })
})

/** The frame of a step with closures that answer nothing: only the build is looked at. */
const FRAME: NodeAgentLoop = {
    purpose: "order.look:agent",
    instructions: "CRAFT\n\nSHOP",
    step: "STEP",
    input: { input: { orderId: "o-1" } },
    tools: [
        { name: "order.read", does: "Reads an order.", argsSchema: { type: "object", properties: { id: { type: "string" } } } },
        { name: "order.void", does: "Voids an order.", argsSchema: null },
    ],
    maxTurns: 4,
    call: () => Promise.resolve({ ok: true, result: null }),
    done: () => ({ ok: true }),
    confused: () => ({ ok: true }),
}

describe("AgentLoopClient: the agent it builds", () => {
    it("has exactly one middleware, the loop's own, no response format, no checkpointer and no store", () => {
        const { agent } = stepAgentOf(FRAME, scriptedModel([]).model, fakeModel(), {}, (act) => act())

        expect(agent.options.middleware?.map((one) => one.name)).toEqual([STEP_MIDDLEWARE])
        expect(agent.options.responseFormat).toBeUndefined()
        expect(agent.options.checkpointer).toBe(false)
        expect(agent.checkpointer).toBe(false)
        expect(agent.options.store).toBeUndefined()
    })

    it("gives the library no tool it could run: plain definitions, the agent's set in the runner's order, then done and confused", () => {
        const { agent } = stepAgentOf(FRAME, scriptedModel([]).model, fakeModel(), {}, (act) => act())
        const tools = agent.options.tools ?? []

        expect(tools.slice(0, 2)).toEqual([
            {
                type: "function",
                function: {
                    name: "order.read",
                    description: "Reads an order.",
                    parameters: { type: "object", properties: { id: { type: "string" } } },
                },
            },
            { type: "function", function: { name: "order.void", description: "Voids an order.", parameters: { type: "object", properties: {} } } },
        ])
        expect(namesOf(tools)).toEqual(["order.read", "order.void", DONE_TOOL, CONFUSED_TOOL])
        expect(tools.some((tool) => "invoke" in tool)).toBe(false)
    })

    it("builds over the model side's client when it names one, and never asks through it", async () => {
        const placeholder = fakeModel()
        const scripted = scriptedModel([{ done: {} }], { model: placeholder })
        const client = await build()

        await client.run(FRAME, scripted.model)

        expect(placeholder.callCount).toBe(0)
        expect(scripted.chat.callCount).toBe(1)
    })

})

describe("AgentLoopClient: a model side with no client (no AI endpoint)", () => {
    it("builds no agent and takes no turn when the model side names no client: the run ends with the model side's own error", async () => {
        const unavailable = new LanggraphError({ code: LanggraphErrorCode.NotPlain, params: { at: "no AI endpoint" } })
        const turn = jest.fn().mockRejectedValue(unavailable)
        const client = await build()

        await expect(client.run(FRAME, { toolChoice: "auto", turn })).rejects.toBe(unavailable)
        expect(turn).toHaveBeenCalledTimes(1)
    })
})

describe("AgentLoopClient: what every request carries", () => {
    it("sends every request with the model side's tool choice and parallel calls off, on the client of the try", async () => {
        const scripted = scriptedModel([{ call: { tool: "order.read", args: { id: "o-1" } } }, { done: {} }], { toolChoice: "required" })
        const client = await build()

        await client.run(FRAME, scripted.model)

        expect(scripted.bound.map((one) => one.options)).toEqual([
            { tool_choice: "required", parallel_tool_calls: false },
            { tool_choice: "required", parallel_tool_calls: false },
        ])
    })

    it("reaches no network while it runs: nothing is sent to a tracing service", async () => {
        const fetched = jest.spyOn(globalThis, "fetch")
        const client = await build()

        await client.run(FRAME, scriptedModel([{ call: { tool: "order.read", args: {} } }, { done: {} }]).model)

        expect(fetched).not.toHaveBeenCalled()
        fetched.mockRestore()
    })
})

describe("AgentLoopClient: the frame, as the model is sent it", () => {
    it("shares the system message and the tools between two steps of one agent, byte for byte, and opens the user message with the step", async () => {
        const client = await build()
        const settle = run({ model: [PAY, DONE] }, client)
        const tell = run({ model: [TELL, { done: { told: true } }] }, client, tellNode)
        await settle.ran
        await tell.ran

        const [settleSystem, settleUser] = settle.scripted.chat.calls[0]?.messages ?? []
        const [tellSystem, tellUser] = tell.scripted.chat.calls[0]?.messages ?? []
        const [settleStep, tellStep] = [settle.loops[0]?.step ?? "?", tell.loops[0]?.step ?? "?"]
        expect(settle.scripted.chat.calls[0]?.messages).toHaveLength(2)
        expect(settleSystem?.type).toBe("system")
        // One string, never a list of parts: the bytes a provider caches are the runner's own.
        expect(settleSystem?.content).toBe(settle.loops[0]?.instructions)
        expect(tellSystem?.content).toBe(settleSystem?.content)
        expect(JSON.stringify(tell.scripted.bound[0]?.tools)).toBe(JSON.stringify(settle.scripted.bound[0]?.tools))
        expect(namesOf(settle.scripted.bound[0]?.tools ?? [])).toEqual(["agent-message.post", "nivo.tool.payment.order.settle", DONE_TOOL, CONFUSED_TOOL])
        // The step is the first thing after everything shared; the system message holds none of it.
        expect(settleUser?.type).toBe("human")
        expect(settleUser?.text.startsWith(settleStep)).toBe(true)
        expect(tellUser?.text.startsWith(tellStep)).toBe(true)
        expect(tellStep).not.toBe(settleStep)
        expect(settleSystem?.text).not.toContain("Mark the order paid")
        expect(settleUser?.text.endsWith(JSON.stringify({ input: { orderId: "o-1", transactionId: "tx-1" } }))).toBe(true)
    })

    it("ENG1: on a client that takes cache breakpoints, marks the end of the shared system message; the text stays the runner's", async () => {
        const client = await build()
        const settle = run({ model: [PAY, DONE] }, client, settleNode, "anthropic")
        const tell = run({ model: [TELL, { done: { told: true } }] }, client, tellNode, "anthropic")
        await settle.ran
        await tell.ran

        const [settleSystem] = settle.scripted.chat.calls[0]?.messages ?? []
        const [tellSystem] = tell.scripted.chat.calls[0]?.messages ?? []
        const marked = [{ type: "text", text: settle.loops[0]?.instructions, cache_control: { type: "ephemeral" } }]
        expect(settleSystem?.content).toEqual(marked)
        expect(tellSystem?.content).toEqual(settleSystem?.content)
        expect(settleSystem?.text).toBe(settle.loops[0]?.instructions)
    })

    it("keeps the tools and the opening of a step the same on every turn of it", async () => {
        const { ran, scripted } = run({ model: [TELL, PAY, DONE] }, await build())
        await ran

        expect(new Set(scripted.bound.map((one) => JSON.stringify(one.tools))).size).toBe(1)
        const opening = sentOf(scripted.chat.calls[0]?.messages ?? [])
        expect(sentOf(scripted.chat.calls[1]?.messages ?? []).slice(0, 2)).toEqual(opening)
        expect(sentOf(scripted.chat.calls[2]?.messages ?? []).slice(0, 2)).toEqual(opening)
        expect(sentOf(scripted.chat.calls[2]?.messages ?? []).map(([kind]) => kind)).toEqual(["system", "human", "ai", "tool", "ai", "tool"])
    })
})
