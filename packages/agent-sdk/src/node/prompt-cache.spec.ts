import { z } from "../schema/zod-entry"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import { defineEffect, defineTool } from "./effect"
import { guidedModelRequest, runNode } from "./host"
import type { NodeRunRequest } from "./host.types"
import { defineNode } from "./node"
import type { Namespaced } from "../schema/schema.types"
import type { NodeDefinition, NodeModelRequest, TurnRef } from "./node.types"

/**
 * PROMPT CACHE: a provider caches the prefix of a prompt, so the stable part of every model call of the engine (`instructions`: the
 * agent's craft and tool set, the shop's policy values, the step) must be the same text, byte for byte, whatever changes from call
 * to call; the volatile part (`volatile`, `input`) comes after it. These specs hold that layout.
 */

const settle = defineEffect({
    id: "payment.order.settle",
    title: { key: "t.settle" },
    payload: z.object({ orderId: z.string(), transactionId: z.string() }),
    rights: [],
})
const send = defineEffect({
    id: "customer.message.send",
    title: { key: "t.send" },
    payload: z.object({ conversationId: z.string(), text: z.string() }),
    rights: [],
})
const lookUp = defineTool({
    id: "catalog.item.find",
    title: { key: "t.find" },
    args: z.object({ words: z.string() }),
    result: z.object({ items: z.array(z.string()) }),
    rights: [],
    mutates: false,
})

const EFFECTS = new Map([settle, send].map((effect) => [effect.id, effect]))
const TOOLS = new Map([[lookUp.id, lookUp]])

/** The agent's whole set, as its module declares it: given out of name order on purpose. */
const AGENT_TOOLS = ["payment.order.settle", "catalog.item.find", "customer.message.send"]

const stepOf = (
    id: Namespaced,
    goal: string,
    effects: ReadonlyArray<Namespaced>,
    output: z.ZodType,
    done: unknown,
): NodeDefinition =>
    defineNode({
        id,
        role: "output",
        title: { key: "t" },
        params: z.object({}),
        input: z.record(z.string(), z.unknown()),
        output,
        rights: [],
        effects: [...effects],
        run: async (input, context) => {
            const decision = await context.agent.run({ goal, input, output })
            return decision.kind === "confused" ? context.confused(decision.confusion) : decision.value
        },
        examples: [{ name: "answers", params: {}, input: {}, output: done, effects: [], model: [{ done }] }],
    })

const SETTLE_STEP = stepOf("payment.settle", "Mark the order paid.", ["payment.order.settle"], z.object({ paid: z.boolean() }), {
    paid: true,
})
const REPLY_STEP = stepOf("chat.reply", "Answer the customer.", ["customer.message.send"], z.object({ said: z.string() }), {
    said: "ok",
})

const TURN: TurnRef = {
    ...EXAMPLE_TURN,
    guidance: "Speak kindly. Never promise a refund.",
    policy: { refundDays: 7, approvalThresholdVnd: 5_000_000 },
    agentTools: AGENT_TOOLS,
}

/** Runs a step to its `done` and answers every model request it made. */
const asksOf = async (
    node: NodeDefinition,
    turn: TurnRef,
    input: Readonly<Record<string, unknown>>,
    key: string,
    model: ReadonlyArray<unknown>,
): Promise<ReadonlyArray<NodeModelRequest>> => {
    const fake = scriptedNodePorts({ model: [...model] })
    const json = jest.spyOn(fake.ports.model, "json")
    const request: NodeRunRequest = {
        node,
        params: {},
        input,
        turn,
        grant: { rights: [] },
        effects: EFFECTS,
        tools: TOOLS,
        key,
    }
    await runNode(request, fake.ports)
    return json.mock.calls.map((call) => call[1])
}

const PAID = { done: { paid: true } }
const SETTLE_CALL = { call: { tool: "payment.order.settle", args: { orderId: "o-1", transactionId: "tx-1" } } }

describe("prompt cache: what the tool set costs", () => {
    const audience = "Who also reads the line: the owner alone, or a group too."
    const post = defineEffect({
        id: "team.message.post",
        title: { key: "effectTeamPost" },
        payload: z.union([
            z.object({ kind: z.literal("text"), text: z.string(), audience: z.string().describe(audience) }),
            z.object({ kind: z.literal("card"), orderId: z.string(), audience: z.string().describe(audience) }),
        ]),
        rights: [],
    })
    const frameOf = (words?: (key: string) => string | undefined) => ({
        turn: { ...EXAMPLE_TURN, agentTools: ["team.message.post", "customer.message.send"] },
        effects: new Map([post, send].map((effect) => [effect.id, effect])),
        tools: new Map(),
        ...(words === undefined ? {} : { words }),
    })
    const shown = (words?: (key: string) => string | undefined): string =>
        guidedModelRequest(frameOf(words), { purpose: "p", instructions: "Decide.", input: {} }).instructions

    it("says what a tool does in words, never as a bare text key; a key with no words stays the key", () => {
        const text = shown((key) => (key === "effectTeamPost" ? "Tell the owner in the chat" : undefined))

        expect(text).toContain('"does":"Tell the owner in the chat"')
        expect(text).not.toContain("effectTeamPost")
        expect(text).toContain('"does":"t.send"')
        expect(shown()).toContain('"does":"effectTeamPost"')
    })

    it("states a description every branch of a union repeats once, and keeps every branch's members", () => {
        const text = shown()

        expect(text.split(audience)).toHaveLength(2)
        expect(text.match(/"audience":/gu)).toHaveLength(2)
        expect(text).toContain('"const":"text"')
        expect(text).toContain('"const":"card"')
        expect(text).toContain("a description is written once")
    })

    it("leaves the dialect address out of every schema it shows", async () => {
        expect(shown()).not.toContain("$schema")
        const [asked] = await asksOf(SETTLE_STEP, TURN, {}, "k", [PAID])
        expect(asked?.instructions).not.toContain("$schema")
    })
})

describe("prompt cache: the stable prefix of a model call", () => {
    it("is byte-identical for the same agent, shop and step whatever the volatile data is", async () => {
        const [first] = await asksOf(SETTLE_STEP, TURN, { orderId: "o-1", at: "2026-11-10T01:00:00Z" }, "run-1:settle", [PAID])
        const [second] = await asksOf(
            SETTLE_STEP,
            {
                ...TURN,
                turnId: "turn-other",
                subject: { kind: "lead", id: "lead-77" },
                waitingOnFounder: [{ step: "Đánh dấu đã trả", since: "2026-11-10T04:00:00.000Z" }],
                founderAnswers: [{ text: "duyệt", at: "2026-11-10T05:00:00.000Z" }],
                alreadySent: [{ text: "Dạ shop đang kiểm tra ạ.", at: "2026-11-10T04:30:00.000Z" }],
            },
            { orderId: "o-999", at: "2026-11-11T09:30:00Z", thread: ["hello", "còn hàng không"] },
            "run-2:settle",
            [PAID],
        )

        expect(first?.instructions).toBe(second?.instructions)
        // What differs rides after the stable part.
        expect(first?.volatile).toBeUndefined()
        expect(second?.volatile).toEqual(expect.stringContaining("`founderAnswers`"))
        expect(second?.input).not.toEqual(first?.input)
    })

    it("holds nothing volatile: no id of the run, the turn or its subject, no clock, no thread", async () => {
        const turn: TurnRef = {
            ...TURN,
            turnId: "turn-SECRET",
            subject: { kind: "lead", id: "lead-SECRET" },
            founderAnswers: [{ text: "answer-SECRET", at: "2026-11-10T05:00:00.000Z" }],
            alreadySent: [{ text: "sent-SECRET", at: "2026-11-10T04:30:00.000Z" }],
        }
        const [asked] = await asksOf(SETTLE_STEP, turn, { thread: "thread-SECRET" }, "run-SECRET:settle", [PAID])

        expect(asked?.instructions).not.toMatch(/SECRET|2026-11-10/u)
        expect(JSON.stringify(asked?.input)).toContain("thread-SECRET")
    })

    it("is shared by two different steps of the agent up to the step itself: the craft, the whole tool set and the shop's values", async () => {
        const [settleAsk] = await asksOf(SETTLE_STEP, TURN, {}, "run-1:settle", [PAID])
        const [replyAsk] = await asksOf(REPLY_STEP, TURN, {}, "run-1:reply", [{ done: { said: "ok" } }])
        const settled = settleAsk?.instructions ?? ""
        const replied = replyAsk?.instructions ?? ""

        const shared = settled.slice(0, settled.indexOf("Mark the order paid."))
        expect(shared.length).toBeGreaterThan(0)
        expect(replied.startsWith(shared)).toBe(true)
        expect(replied.slice(shared.length).startsWith("Answer the customer.")).toBe(true)
        // The shared part is L1 then L2: guidance, the full set in name order (not the step's own tools), how turns go, the values.
        expect(shared.startsWith("Speak kindly. Never promise a refund.\n\n")).toBe(true)
        const names = ['"name":"catalog.item.find"', '"name":"customer.message.send"', '"name":"payment.order.settle"']
        const places = names.map((name) => shared.indexOf(name))
        expect(places.every((place) => place > 0)).toBe(true)
        expect([...places].sort((left, right) => left - right)).toEqual(places)
        expect(shared.indexOf("You act by calling tools")).toBeGreaterThan(places[2] ?? 0)
        expect(shared.endsWith('{"approvalThresholdVnd":5000000,"refundDays":7}\n\n')).toBe(true)
        // The step names what it may call; the right itself stays in code.
        expect(settled.slice(shared.length)).toContain('"tools":["payment.order.settle"]')
    })

    it("writes equal data as equal text: the order the values or the tool ids were given in does not show", async () => {
        const shuffled: TurnRef = {
            ...TURN,
            policy: { approvalThresholdVnd: 5_000_000, refundDays: 7 },
            agentTools: [...AGENT_TOOLS].reverse(),
        }
        const [first] = await asksOf(SETTLE_STEP, TURN, {}, "k", [PAID])
        const [second] = await asksOf(SETTLE_STEP, shuffled, {}, "k", [PAID])

        expect(second?.instructions).toBe(first?.instructions)
    })

    it("keeps the turns of one step append-only: every turn has the same stable part, and the calls so far only grow at the end", async () => {
        const asks = await asksOf(SETTLE_STEP, TURN, { orderId: "o-1" }, "run-1:settle", [SETTLE_CALL, SETTLE_CALL, PAID])
        expect(asks).toHaveLength(3)
        expect(new Set(asks.map((ask) => ask.instructions)).size).toBe(1)

        const texts = asks.map((ask) => JSON.stringify(ask.input))
        const opening = (text: string): string => text.slice(0, text.lastIndexOf('],"turnsLeft"'))
        expect(Object.keys(asks[0]?.input ?? {})).toEqual(["input", "calls", "turnsLeft"])
        expect(opening(texts[1] ?? "").startsWith(opening(texts[0] ?? ""))).toBe(true)
        expect(opening(texts[2] ?? "").startsWith(opening(texts[1] ?? ""))).toBe(true)
    })

    it("lays a host's own call for the agent out the same way, so it shares the craft, the tool set and the values", async () => {
        const [stepAsk] = await asksOf(SETTLE_STEP, TURN, {}, "k", [PAID])
        const core = guidedModelRequest(
            { turn: TURN, effects: EFFECTS, tools: TOOLS },
            { purpose: "core", instructions: "Decide what to do with the stuck step.", input: { reason: "x" } },
        )

        const craft = core.instructions.slice(0, core.instructions.indexOf("The values of this policy"))
        expect(craft.startsWith("Speak kindly. Never promise a refund.\n\n")).toBe(true)
        expect(craft).toContain('"name":"catalog.item.find"')
        // The guidance and the tool set open a step's call with the same text.
        expect(stepAsk?.instructions.startsWith(craft.trimEnd())).toBe(true)
        expect(core.instructions.endsWith('{"approvalThresholdVnd":5000000,"refundDays":7}\n\nDecide what to do with the stuck step.')).toBe(true)
    })
})
