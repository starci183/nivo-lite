import { z } from "../schema/zod-entry"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import type { FakeNodePortsOptions } from "../tests/fixtures/node-ports"
import { defineEffect } from "./effect"
import { callDigestOf, runNode } from "./host"
import type { NodeHostPorts } from "./host.types"
import { isNodeConfused } from "./memory"
import { defineNode } from "./node"

/**
 * THE FAKE SHAPE OF AN AGENT RUN (read this, do not guess). `fakeNodePorts({ model: [...] })` scripts the agent one turn per entry,
 * in order, with the very shapes the model answers:
 *   { call: { tool: "<declared effect or tool id>", args: { ... } } }   one tool call; its result or refusal is fed back
 *   { done: <the output, fitting the `output` schema> }                  the final answer
 *   { confused: { reason: "...", question: "..." | null } }              the agent gives up; the node returns context.confused(...)
 * An effect the fake runs answers the subject `{ kind: "<effect id>", id: "<effect id>-<n>" }`; `fake.executed` lists the calls.
 * To script what an effect answers (a refusal, a subject with facts), per effect id and in call order:
 *   fakeNodePorts({ answers: { "order.confirm": [{ kind: "refused", id: "waits_owner", facts: { amountVnd: 5_000_000 } }] } })
 * and the same `answers` field on a node example. A call past the list answers the made-up subject.
 */

const markPaid = defineEffect({
    id: "payment.order.settle",
    title: { key: "t" },
    payload: z.object({ orderId: z.string(), transactionId: z.string() }),
    rights: [],
})
const tellTeam = defineEffect({
    id: "agent-message.post",
    title: { key: "t" },
    payload: z.object({ text: z.string() }),
    rights: [],
})

const OUTPUT = z.object({ result: z.enum(["paid", "not-paid"]), orderId: z.string() })

/** A step in the new shape: a goal, the tools it may use, the tool it must have used, the output it returns. No effect is called by hand. */
const settleNode = defineNode({
    id: "payment.settle",
    role: "output",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ orderId: z.string(), transactionId: z.string() }),
    output: OUTPUT,
    rights: [],
    effects: ["payment.order.settle", "agent-message.post"],
    requires: ["payment.order.settle"],
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
            name: "marks the order paid and tells the team",
            params: {},
            input: { orderId: "o-1", transactionId: "tx-1" },
            output: { result: "paid", orderId: "o-1" },
            effects: ["payment.order.settle"],
            model: [
                { call: { tool: "payment.order.settle", args: { orderId: "o-1", transactionId: "tx-1" } } },
                { done: { result: "paid", orderId: "o-1" } },
            ],
        },
    ],
})

const run = (options: FakeNodePortsOptions, override: Partial<NodeHostPorts> = {}) => {
    const fake = scriptedNodePorts(options)
    const ports = { ...fake.ports, ...override }
    const json = jest.spyOn(ports.model, "json")
    const ran = runNode(
        {
            node: settleNode,
            params: {},
            input: { orderId: "o-1", transactionId: "tx-1" },
            turn: EXAMPLE_TURN,
            grant: { rights: [] },
            effects: new Map([markPaid, tellTeam].map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "run-1:settle",
        },
        ports,
    )
    return { ran, fake, json }
}

const PAY = { call: { tool: "payment.order.settle", args: { orderId: "o-1", transactionId: "tx-1" } } }
const DONE = { done: { result: "paid", orderId: "o-1" } }
const PAY_KEY = `run-1:settle:${callDigestOf("payment.order.settle", PAY.call.args)}`

describe("context.agent.run", () => {
    it("lets the agent call the step's tools itself and answers its output, with the effects the calls ran", async () => {
        const { ran, fake } = run({ model: [PAY, { call: { tool: "agent-message.post", args: { text: "Đã nhận tiền" } } }, DONE] })

        await expect(ran).resolves.toEqual({
            output: { result: "paid", orderId: "o-1" },
            effects: [
                { id: "payment.order.settle", subject: { kind: "payment.order.settle", id: "payment.order.settle-1" } },
                { id: "agent-message.post", subject: { kind: "agent-message.post", id: "agent-message.post-2" } },
            ],
        })
        expect(fake.executed.map((one) => [one.id, one.payload])).toEqual([
            ["payment.order.settle", { orderId: "o-1", transactionId: "tx-1" }],
            ["agent-message.post", { text: "Đã nhận tiền" }],
        ])
    })

    it("keys every call itself, by the step, the tool and its arguments: the agent types no key", async () => {
        const { ran, fake } = run({ model: [PAY, { call: { tool: "agent-message.post", args: { text: "x" } } }, DONE] })
        await ran
        expect(fake.executed.map((one) => one.key)).toEqual([
            `run-1:settle:${callDigestOf("payment.order.settle", { orderId: "o-1", transactionId: "tx-1" })}`,
            `run-1:settle:${callDigestOf("agent-message.post", { text: "x" })}`,
        ])
    })

    it("shows the model the tools with their schemas, the step's own tools, the required ones and the output schema in the instructions, and what was called so far in the data", async () => {
        const { ran, json } = run({ model: [PAY, DONE] })
        await ran

        const second = json.mock.calls[1]?.[1]
        expect(second?.purpose).toBe("payment.settle:agent")
        const instructions = second?.instructions ?? ""
        // The tool set in name order with each schema, then how turns are taken, then the step: its goal and its frame.
        expect(instructions.indexOf('"name":"agent-message.post"')).toBeGreaterThan(-1)
        expect(instructions.indexOf('"name":"agent-message.post"')).toBeLessThan(
            instructions.indexOf('"name":"payment.order.settle"'),
        )
        expect(instructions.indexOf('"name":"payment.order.settle"')).toBeLessThan(
            instructions.indexOf("Mark the order paid with the bank transaction, then tell the team."),
        )
        expect(instructions).toContain('"required":["payment.order.settle"],"tools":["payment.order.settle","agent-message.post"]}')
        expect(instructions).toContain('"outputSchema":{')
        expect(second?.input).toEqual({
            input: { orderId: "o-1", transactionId: "tx-1" },
            calls: [expect.objectContaining({ tool: "payment.order.settle", ok: true })],
            turnsLeft: 2,
        })
        expect(second?.volatile).toBeUndefined()
    })

    it("refuses the output until every required call succeeded, and tells the agent why", async () => {
        const { ran, json, fake } = run({ model: [DONE, PAY, DONE] })

        await expect(ran).resolves.toMatchObject({ output: { result: "paid" } })
        expect(json.mock.calls[1]?.[1].input).toMatchObject({
            calls: [{ done: "refused", refused: { code: "REQUIRED_CALL_MISSING", message: "payment.order.settle" } }],
        })
        expect(fake.executed).toHaveLength(1)
    })

    it("hands a guard's refusal back to the agent as a fact, and a required call that never succeeded can never be answered for", async () => {
        const refusal = Object.assign(new Error("SALES_EFFECTS_ORDER_NOT_OPEN"), {
            code: "SALES_EFFECTS_ORDER_NOT_OPEN",
            params: { reason: "order_not_open" },
        })
        const { ran, json } = run(
            { model: [PAY, DONE, { confused: { reason: "Đơn đã đóng, không nhận khoản chuyển", question: "Xử lý khoản dư thế nào?" } }] },
            { execute: () => Promise.reject(refusal) },
        )

        const cause = await ran.then(
            () => null,
            (thrown: unknown) => thrown,
        )

        expect(isNodeConfused(cause)).toBe(true)
        expect(isNodeConfused(cause) ? cause.confusion.question : null).toBe("Xử lý khoản dư thế nào?")
        expect(json.mock.calls[1]?.[1].input).toMatchObject({
            calls: [
                {
                    tool: "payment.order.settle",
                    ok: false,
                    refused: { code: "SALES_EFFECTS_ORDER_NOT_OPEN", data: { reason: "order_not_open" } },
                },
            ],
        })
        expect(json.mock.calls[2]?.[1].input).toMatchObject({
            calls: [{ ok: false }, { done: "refused", refused: { code: "REQUIRED_CALL_MISSING" } }],
        })
    })

    it("reads a tool's own refusal (`{ kind: \"refused\" }`) as a fact with its true values: it satisfies no required call and is no effect of the step", async () => {
        const refused = { kind: "refused", id: "waits_owner", facts: { amountVnd: 5_000_000, thresholdVnd: 2_000_000 } }
        const { ran, json } = run(
            { model: [PAY, DONE, { confused: { reason: "Đơn chờ chủ tiệm duyệt", question: null } }] },
            { execute: () => Promise.resolve(refused) },
        )

        const cause = await ran.then(
            () => null,
            (thrown: unknown) => thrown,
        )

        expect(isNodeConfused(cause)).toBe(true)
        expect(json.mock.calls[2]?.[1].input).toMatchObject({
            calls: [
                {
                    tool: "payment.order.settle",
                    ok: false,
                    refused: { code: "waits_owner", data: { amountVnd: 5_000_000, thresholdVnd: 2_000_000 } },
                },
                { done: "refused", refused: { code: "REQUIRED_CALL_MISSING" } },
            ],
        })
    })

    it("feeds the facts a tool answers back to the agent, and makes the refused call again under the same key", async () => {
        const answers = [
            { kind: "refused", id: "waits_owner" },
            { kind: "order", id: "o-1", facts: { amountVnd: 1000 } },
        ]
        const execute = jest.fn(() => Promise.resolve(answers.shift() ?? { kind: "order", id: "o-1" }))
        const { ran, json } = run({ model: [PAY, PAY, DONE] }, { execute })

        await expect(ran).resolves.toEqual({
            output: { result: "paid", orderId: "o-1" },
            effects: [{ id: "payment.order.settle", subject: { kind: "order", id: "o-1", facts: { amountVnd: 1000 } } }],
        })
        expect(execute.mock.calls.map((call) => Reflect.get(call, 2))).toEqual([
            { key: PAY_KEY, dedupeKey: null },
            { key: PAY_KEY, dedupeKey: null },
        ])
        expect(json.mock.calls[2]?.[1].input).toMatchObject({
            calls: [{ ok: false }, { ok: true, subject: { kind: "order", id: "o-1", facts: { amountVnd: 1000 } } }],
        })
    })

    it("refuses a tool the node did not declare and arguments its schema refuses, as facts", async () => {
        const { ran, json, fake } = run({
            model: [
                { call: { tool: "order.void", args: { id: "o-1" } } },
                { call: { tool: "payment.order.settle", args: { orderId: 1 } } },
                PAY,
                DONE,
            ],
        })

        await expect(ran).resolves.toMatchObject({ output: { result: "paid" } })
        expect(json.mock.calls[2]?.[1].input).toMatchObject({
            calls: [
                { tool: "order.void", ok: false, refused: { code: "TOOL_NOT_OFFERED" } },
                { tool: "payment.order.settle", ok: false, refused: { code: "EFFECT_PAYLOAD_INVALID" } },
            ],
        })
        expect(fake.executed).toHaveLength(1)
    })

    it("refuses an output that does not fit the schema, and an agent out of turns is confused, never guessed for", async () => {
        const { ran } = run({ model: [PAY, { done: { result: "maybe" } }, { done: { result: "maybe" } }, { done: {} }] })

        const cause = await ran.then(
            () => null,
            (thrown: unknown) => thrown,
        )

        expect(isNodeConfused(cause)).toBe(true)
        expect(isNodeConfused(cause) ? cause.confusion.reason : "").toContain("AGENT_TURNS_EXHAUSTED")
    })
})

describe("an agent of a turn whose customer has something waiting for the founder", () => {
    it("is told what waits and the one limit that goes with it; an ordinary turn is told nothing of the kind", async () => {
        const fake = scriptedNodePorts({ model: [PAY, DONE] })
        const json = jest.spyOn(fake.ports.model, "json")
        const waiting = [{ step: "Đánh dấu đã trả", since: "2026-11-10T04:00:00.000Z" }]
        await runNode(
            {
                node: settleNode,
                params: {},
                input: { orderId: "o-1", transactionId: "tx-1" },
                turn: { ...EXAMPLE_TURN, waitingOnFounder: waiting },
                grant: { rights: [] },
                effects: new Map([markPaid, tellTeam].map((effect) => [effect.id, effect])),
                tools: new Map(),
                key: "k",
            },
            fake.ports,
        )
        const asked = json.mock.calls[0]?.[1]
        // The rule holds for this try only: it rides after the stable instructions, never inside them.
        expect(asked?.volatile).toContain("waits for the shop's founder")
        expect(asked?.instructions).not.toContain("waits for the shop's founder")
        expect(asked?.input).toMatchObject({ waitingOnFounder: waiting })

        const plain = run({ model: [PAY, DONE] })
        await plain.ran
        expect(plain.json.mock.calls[0]?.[1].volatile).toBeUndefined()
        expect(plain.json.mock.calls[0]?.[1].instructions).toBe(asked?.instructions)
    })
})

describe("the fake's scripted answers", () => {
    it("answers a scripted refusal for the first call of an effect, then the made-up subject", async () => {
        const { ran, fake } = run({
            model: [PAY, PAY, DONE],
            answers: { "payment.order.settle": [{ kind: "refused", id: "order_not_open", facts: { expectedVnd: 1000 } }] },
        })

        await expect(ran).resolves.toMatchObject({
            effects: [{ id: "payment.order.settle", subject: { kind: "payment.order.settle", id: "payment.order.settle-2" } }],
        })
        expect(fake.executed).toHaveLength(2)
    })
})

describe("defineNode requires", () => {
    it("refuses a required call the node does not declare", () => {
        expect(() =>
            defineNode({ ...settleNode, id: "payment.other", requires: ["order.record"] }),
        ).toThrow("REQUIRES_UNDECLARED")
    })
})
