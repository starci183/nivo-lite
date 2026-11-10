import { AIMessage, type BaseMessage } from "@langchain/core/messages"
import { Annotation, Command, END, START, StateGraph, interrupt, task } from "@langchain/langgraph"
import { MemorySaver } from "@langchain/langgraph-checkpoint"
import { Test } from "@nestjs/testing"
import type { NodeAgentCallAnswer, NodeAgentLoop } from "@nivo-lite/agent-sdk/node"
import { fakeModel } from "langchain"
import { LanggraphError, LanggraphErrorCode } from "../errors/langgraph.error"
import { AgentLoopClient } from "./agent-loop.client"
import type { AgentLoopAnswer, AgentLoopModel } from "./agent-loop.port"
import { CONFUSED_TOOL, DONE_TOOL, ONE_CALL_REFUSAL, TOOL_CALL_REFUSAL } from "./loop-frame.policy"

/** The arguments of a tool call. */
type Args = Readonly<Record<string, unknown>>

/** One tool call of a model answer, by the name the model writes. */
interface Call {
    readonly name: string
    readonly args: Args
}

/** One scripted model answer: words alone, or the tool calls it makes (one, or several at once). */
type Answer = string | ReadonlyArray<Call>

/** A model answer with one tool call. */
const one = (name: string, args: Args = {}): Answer => [{ name, args }]

/** A scripted chat with what it was asked. */
interface Scripted {
    readonly model: AgentLoopModel
    readonly chat: ReturnType<typeof fakeModel>
    readonly shown: ReadonlyArray<ReadonlyArray<unknown>>
}

/** A scripted chat model: one answer per model call, in order; a call past the script throws. No network. */
const scripted = (answers: ReadonlyArray<Answer>, extra: Partial<AgentLoopModel> = {}): Scripted => {
    const chat = fakeModel()
    const shown: Array<ReadonlyArray<unknown>> = []
    const bind = chat.bindTools.bind(chat)
    Object.assign(chat, {
        bindTools: (tools: Parameters<typeof bind>[0]) => {
            shown.push(tools)
            return bind(tools)
        },
    })
    answers.forEach((answer, at) => {
        const calls = typeof answer === "string" ? [] : answer
        chat.respond(
            new AIMessage({
                content: typeof answer === "string" ? answer : "",
                tool_calls: calls.map((call, index) => ({ type: "tool_call", id: `call-${at + 1}-${index + 1}`, ...call })),
            }),
        )
    })
    return { model: { toolChoice: "auto", model: chat, turn: (attempt) => attempt(chat, 1), ...extra }, chat, shown }
}

/** The messages one model call was sent, as kind and text. */
const sentOf = (messages: ReadonlyArray<BaseMessage> | undefined): ReadonlyArray<readonly [string, string]> =>
    (messages ?? []).map((message) => [message.type, message.text] as const)

/** The loop, built the way Nest builds it; the middleware under test is the one it builds every agent with. */
const build = async (): Promise<AgentLoopClient> => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentLoopClient] }).compile()
    return moduleRef.get(AgentLoopClient)
}

/** A frame with closures a spec can watch. */
interface Watched {
    readonly loop: NodeAgentLoop
    readonly call: jest.Mock<ReturnType<NodeAgentLoop["call"]>, Parameters<NodeAgentLoop["call"]>>
    readonly done: jest.Mock<ReturnType<NodeAgentLoop["done"]>, Parameters<NodeAgentLoop["done"]>>
    readonly confused: jest.Mock<ReturnType<NodeAgentLoop["confused"]>, Parameters<NodeAgentLoop["confused"]>>
}

/** The frame of a step whose closures take everything, unless a case says otherwise. */
const frameOf = (over: Partial<NodeAgentLoop> = {}): Watched => {
    const call = jest.fn<ReturnType<NodeAgentLoop["call"]>, Parameters<NodeAgentLoop["call"]>>(() =>
        Promise.resolve({ ok: true, result: { seen: true } }),
    )
    const done = jest.fn<ReturnType<NodeAgentLoop["done"]>, Parameters<NodeAgentLoop["done"]>>(() => ({ ok: true }))
    const confused = jest.fn<ReturnType<NodeAgentLoop["confused"]>, Parameters<NodeAgentLoop["confused"]>>(() => ({ ok: true }))
    const loop: NodeAgentLoop = {
        purpose: "order.look:agent",
        instructions: "CRAFT\n\nSHOP",
        step: "STEP",
        input: { input: { orderId: "o-1" } },
        tools: [
            { name: "order.read", does: "Reads an order.", argsSchema: null },
            { name: "order.void", does: "Voids an order.", argsSchema: null },
        ],
        maxTurns: 4,
        call,
        done,
        confused,
        ...over,
    }
    return { loop, call, done, confused }
}

describe("stepMiddlewareOf: one tool call per model answer", () => {
    it("takes the first call, refuses every other as ONE_CALL_PER_TURN without asking the runner, and charges a turn for each", async () => {
        const { loop, call } = frameOf({ maxTurns: 4 })
        const three: Answer = [
            { name: "order.read", args: { id: "o-1" } },
            { name: "order.void", args: { id: "o-1" } },
            { name: "order.read", args: { id: "o-2" } },
        ]
        const { model, chat } = scripted([three, one("order.read", { id: "o-3" }), one(DONE_TOOL, { output: {} })])
        const client = await build()

        const end = await client.run(loop, model)

        // Three turns went on the first answer, the fourth on the second: the third answer is never asked for.
        expect(call.mock.calls).toEqual([
            ["order.read", { id: "o-1" }],
            ["order.read", { id: "o-3" }],
        ])
        expect(chat.callCount).toBe(2)
        expect(end).toEqual({ turns: 4 })
        // Every call of the answer has its tool message, so the next request is well-formed.
        expect(sentOf(chat.calls[1]?.messages).slice(2)).toEqual([
            ["ai", ""],
            ["tool", JSON.stringify({ ok: true, result: { seen: true } })],
            ["tool", JSON.stringify(ONE_CALL_REFUSAL)],
            ["tool", JSON.stringify(ONE_CALL_REFUSAL)],
        ])
    })

    it("never has two calls of the runner in flight at once", async () => {
        const flight = { now: 0, most: 0 }
        const { loop } = frameOf({
            call: async () => {
                flight.now += 1
                flight.most = Math.max(flight.most, flight.now)
                await Promise.resolve()
                await Promise.resolve()
                flight.now -= 1
                return { ok: true, result: null }
            },
        })
        const pair: Answer = [
            { name: "order.read", args: {} },
            { name: "order.void", args: {} },
        ]
        const client = await build()

        await client.run(loop, scripted([pair, pair]).model)

        expect(flight.most).toBe(1)
    })

    it("refuses `done` too when it comes second: the output is not taken", async () => {
        const { loop, done } = frameOf()
        const both: Answer = [
            { name: "order.read", args: {} },
            { name: DONE_TOOL, args: { output: { early: true } } },
        ]
        const client = await build()

        await client.run(loop, scripted([both, one(DONE_TOOL, { output: { late: true } })]).model)

        expect(done.mock.calls).toEqual([[{ late: true }]])
    })
})

describe("stepMiddlewareOf: a model answer with no tool call", () => {
    it("is answered with a refusal the model reads next, and costs a turn", async () => {
        const { loop, call, done } = frameOf({ maxTurns: 3 })
        const { model, chat } = scripted(["Let me think.", one("order.read"), one(DONE_TOOL, { output: { ok: 1 } })])
        const client = await build()

        const end = await client.run(loop, model)

        expect(sentOf(chat.calls[1]?.messages).slice(2)).toEqual([
            ["ai", "Let me think."],
            ["human", JSON.stringify(TOOL_CALL_REFUSAL)],
        ])
        expect(call).toHaveBeenCalledTimes(1)
        expect(done).toHaveBeenCalledWith({ ok: 1 })
        expect(end).toEqual({ turns: 3 })
    })

    it("ends the loop with nothing taken when it was the last turn", async () => {
        const { loop, done, confused } = frameOf({ maxTurns: 2 })
        const { model, chat } = scripted(["a", "b", one(DONE_TOOL, { output: {} })])
        const client = await build()

        const end = await client.run(loop, model)

        expect(end).toEqual({ turns: 2 })
        expect(chat.callCount).toBe(2)
        expect(done).not.toHaveBeenCalled()
        expect(confused).not.toHaveBeenCalled()
    })
})

describe("stepMiddlewareOf: the turns of a step", () => {
    it("stops asking the model after maxTurns and returns with nothing taken", async () => {
        const { loop, call } = frameOf({ maxTurns: 3 })
        const again = one("order.read")
        const { model, chat } = scripted([again, again, again, again, again])
        const client = await build()

        const end = await client.run(loop, model)

        expect(end).toEqual({ turns: 3 })
        expect(chat.callCount).toBe(3)
        expect(call).toHaveBeenCalledTimes(3)
    })

    it("relays the runner's refusal of an output and goes on; the loop ends on the output it takes", async () => {
        const { loop, done } = frameOf()
        const refusal = { ok: false, refused: { code: "OUTPUT_INVALID", message: "no" } } as const
        done.mockReturnValueOnce(refusal)
        const { model, chat } = scripted([one(DONE_TOOL, { output: { bad: 1 } }), one(DONE_TOOL, { output: { good: 1 } }), one(DONE_TOOL, { output: {} })])
        const client = await build()

        const end = await client.run(loop, model)

        expect(done.mock.calls).toEqual([[{ bad: 1 }], [{ good: 1 }]])
        expect(sentOf(chat.calls[1]?.messages).at(-1)).toEqual(["tool", JSON.stringify(refusal)])
        expect(end).toEqual({ turns: 2 })
    })

    it("ends on a confusion the runner takes, handing it the model's reason and question", async () => {
        const { loop, confused } = frameOf()
        const { model, chat } = scripted([one(CONFUSED_TOOL, { reason: "two orders", question: "which one?" }), one("order.read")])
        const client = await build()

        const end = await client.run(loop, model)

        expect(confused.mock.calls).toEqual([[{ reason: "two orders", question: "which one?" }]])
        expect(chat.callCount).toBe(1)
        expect(end).toEqual({ turns: 1 })
    })

})

describe("stepMiddlewareOf: what the model is shown and what the runner is handed", () => {
    it("hands arguments that were no JSON object to the runner as the model wrote them, so the runner refuses them by name", async () => {
        const { loop, call } = frameOf()
        const chat = fakeModel()
            .respond(
                new AIMessage({
                    content: "",
                    invalid_tool_calls: [{ type: "invalid_tool_call", id: "bad-1", name: "order.read", args: "{not json", error: "x" }],
                }),
            )
            .respondWithTools([{ name: DONE_TOOL, args: { output: {} } }])
        const client = await build()

        await client.run(loop, { toolChoice: "auto", model: chat, turn: (attempt) => attempt(chat, 1) })

        expect(call.mock.calls).toEqual([["order.read", "{not json"]])
        // The request that follows stays well-formed: the call is shown with empty arguments and has its tool message.
        expect(sentOf(chat.calls[1]?.messages).map(([kind]) => kind)).toEqual(["system", "human", "ai", "tool"])
    })

    it("puts the volatile rules after the step and before the input in the first user message", async () => {
        const { loop } = frameOf({ volatile: "VOLATILE" })
        const { model, chat } = scripted([one(DONE_TOOL, { output: {} })])
        const client = await build()

        await client.run(loop, model)

        expect(sentOf(chat.calls[0]?.messages)).toEqual([
            ["system", "CRAFT\n\nSHOP"],
            ["human", `STEP\n\nVOLATILE\n\n${JSON.stringify({ input: { orderId: "o-1" } })}`],
        ])
    })

    it("shows and reads wire names only when the model's profile asks for them: the runner always sees the dotted id", async () => {
        const { loop, call } = frameOf()
        const { model, shown } = scripted([one("order__read", { id: "o-1" }), one(DONE_TOOL, { output: {} })], { wireNames: true })
        const client = await build()

        await client.run(loop, model)

        expect(JSON.stringify(shown[0])).toContain('"name":"order__read"')
        expect(JSON.stringify(shown[0])).not.toContain('"name":"order.read"')
        expect(call.mock.calls).toEqual([["order.read", { id: "o-1" }]])
    })
})

describe("stepMiddlewareOf: errors leave the loop as they were thrown", () => {
    /** An error with a code, as the model side throws one when every try failed. */
    const failure = new LanggraphError({ code: LanggraphErrorCode.NotPlain, params: { at: "the model side" } })

    it("lets the model side's error out unchanged: no message is made of it and no further turn is taken", async () => {
        const { loop, call } = frameOf()
        const turn = jest.fn().mockRejectedValue(failure)
        const client = await build()

        const thrown: unknown = await client.run(loop, { toolChoice: "auto", model: fakeModel(), turn }).then(
            () => null,
            (cause: unknown) => cause,
        )

        expect(thrown).toBe(failure)
        expect(turn).toHaveBeenCalledTimes(1)
        expect(call).not.toHaveBeenCalled()
    })

    it("refuses a tool set the name map cannot map before any model call, by name", async () => {
        const { loop } = frameOf({ tools: [{ name: "order__draft.create", does: "Drafts.", argsSchema: null }] })
        const { model, chat } = scripted([one(DONE_TOOL, { output: {} })], { wireNames: true })
        const client = await build()

        await expect(client.run(loop, model)).rejects.toMatchObject({
            code: LanggraphErrorCode.ToolNameUnmappable,
            params: { name: "order__draft.create" },
        })
        expect(chat.callCount).toBe(0)
    })

    it("lets what a closure of the runner throws out unchanged", async () => {
        const { loop } = frameOf({ call: jest.fn().mockRejectedValue(failure) })
        const { model, chat } = scripted([one("order.read"), one(DONE_TOOL, { output: {} })])
        const client = await build()

        await expect(client.run(loop, model)).rejects.toBe(failure)
        expect(chat.callCount).toBe(1)
    })
})

describe("stepMiddlewareOf: inside a thread node that starts again", () => {
    it("takes its turns again from the calls the node recorded: the door is not run twice and the output is taken again", async () => {
        const counts = { asked: 0, door: 0 }
        const door = task("door", (name: string): Promise<NodeAgentCallAnswer> => {
            counts.door += 1
            return Promise.resolve({ ok: true, result: { name } })
        })
        const asked = task("turn", (act: () => Promise<AgentLoopAnswer>): Promise<AgentLoopAnswer> => {
            counts.asked += 1
            return act()
        })
        const visits: Array<unknown> = []
        const client = await build()
        const node = async () => {
            const { loop, done } = frameOf({ call: (name) => door(name).then((fact) => fact) })
            const { model } = scripted([one("order.read"), one(DONE_TOOL, { output: { seen: true } })])
            const end = await client.run(loop, model, { record: (_call, act) => asked(act).then((answer) => answer) })
            visits.push({ end, taken: done.mock.calls })
            return { answer: interrupt<object, string>({ ask: "ok?" }) }
        }
        const graph = new StateGraph(Annotation.Root({ answer: Annotation<string>() }))
            .addNode("step", node)
            .addEdge(START, "step")
            .addEdge("step", END)
            .compile({ checkpointer: new MemorySaver() })
        const config = { configurable: { thread_id: "t-1" } }

        await graph.invoke({ answer: "" }, config)
        const resumed = await graph.invoke(new Command({ resume: "yes" }), config)

        expect(resumed.answer).toBe("yes")
        // The second visit walked the same two turns to the same output from the node's record: nothing was asked or run again.
        expect(visits).toEqual([
            { end: { turns: 2 }, taken: [[{ seen: true }]] },
            { end: { turns: 2 }, taken: [[{ seen: true }]] },
        ])
        expect(counts).toEqual({ asked: 2, door: 1 })
    })
})

describe("stepMiddlewareOf: the name a model turn is recorded under", () => {
    /** The names the loop hands its record, for one run of the frame on the script. */
    const namesOf = async (over: Partial<NodeAgentLoop>, answers: ReadonlyArray<Answer>): Promise<ReadonlyArray<string>> => {
        const names: Array<string> = []
        const { loop } = frameOf(over)
        const client = await build()
        await client.run(loop, scripted(answers).model, {
            record: (call, act) => {
                names.push(call)
                return act()
            },
        })
        return names
    }
    const SCRIPT = [one("order.read", { id: "o-1" }), one(DONE_TOOL, { output: {} })]

    it("is the purpose and the turn, then a digest of what the turn sends: the same in every process for the same content", async () => {
        const first = await namesOf({}, SCRIPT)
        const again = await namesOf({}, SCRIPT)

        expect(first).toHaveLength(2)
        expect(first.map((name) => name.replace(/:[0-9a-f]{32}$/u, ""))).toEqual(["order.look:agent#1", "order.look:agent#2"])
        expect(again).toEqual(first)
        expect(new Set(first).size).toBe(2)
    })

    it("changes with any word the turn sends: another input, other rules for this try, or another fact on an earlier turn", async () => {
        const base = await namesOf({}, SCRIPT)
        const input = await namesOf({ input: { input: { orderId: "o-2" } } }, SCRIPT)
        const volatile = await namesOf({ volatile: "The founder answered: yes" }, SCRIPT)
        const fact = await namesOf({ call: () => Promise.resolve({ ok: true, result: { seen: false } }) }, SCRIPT)

        expect(input[0]).not.toBe(base[0])
        expect(volatile[0]).not.toBe(base[0])
        // The first turn sent the same words; the second carries another fact, so it is another turn.
        expect(fact[0]).toBe(base[0])
        expect(fact[1]).not.toBe(base[1])
    })
})
