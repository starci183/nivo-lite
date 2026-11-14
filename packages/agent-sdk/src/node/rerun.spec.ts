import { z } from "../schema/zod-entry"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import { defineEffect, defineTool } from "./effect"
import type { EffectDefinition } from "./effect.types"
import { guidedModelRequest, runNode } from "./host"
import type { EffectCall, NodeHostPorts } from "./host.types"
import { isNodeConfused } from "./memory"
import { defineNode } from "./node"
import { isRefused } from "./node.types"
import type { EffectPayload, NodeModelRequest, SubjectRef, TurnRef } from "./node.types"

/**
 * A step that runs again (the founder answered its question in the team chat) under the same step key. The ledger of a host keeps the
 * subject of each call under the call's key and answers it to a repeat of that key, so the key decides what a second attempt gets back.
 * These specs hold the rule of the key: it names the tool and its arguments, never the place of the call in the attempt.
 */

const effectOf = (id: `${string}.${string}`, payload: z.ZodType): EffectDefinition =>
    defineEffect({ id, title: { key: "t" }, payload })

const EFFECTS = [
    effectOf("nivo.tool.order.create", z.object({ leadId: z.string() })),
    effectOf("nivo.tool.order.confirm", z.object({ orderId: z.string() })),
    effectOf("nivo.tool.payment.transfer.create", z.object({ orderId: z.string() })),
    effectOf("nivo.tool.customer.message.send", z.object({ conversationId: z.string(), text: z.string() })),
]

const OUTPUT = z.object({ orderId: z.string() })

const stepNode = defineNode({
    id: "sales.create-order",
    role: "output",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ leadId: z.string() }),
    output: OUTPUT,
    effects: [
        "nivo.tool.order.create",
        "nivo.tool.order.confirm",
        "nivo.tool.payment.transfer.create",
        "nivo.tool.customer.message.send",
    ],
    run: async (input, context) => {
        const decision = await context.agent.run({ goal: "Create the order.", input, output: OUTPUT, maxTurns: 6 })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "creates the order",
            params: {},
            input: { leadId: "l-1" },
            output: { orderId: "o-1" },
            effects: ["nivo.tool.order.create"],
            model: [
                { call: { tool: "nivo.tool.order.create", args: { leadId: "l-1" } } },
                { done: { orderId: "o-1" } },
            ],
        },
    ],
})

/** What the executors really did, and a ledger as a host keeps it: the subject of a call by its key, a refusal never kept. */
const worldOf = (refusals: Readonly<Record<string, ReadonlyArray<SubjectRef>>> = {}) => {
    const acted: Array<{ readonly id: string; readonly payload: EffectPayload }> = []
    const ledger = new Map<string, { readonly effect: string; readonly subject: SubjectRef }>()
    const left = new Map(Object.entries(refusals).map(([id, list]) => [id, [...list]]))
    const execute = (effect: EffectDefinition, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> => {
        const kept = ledger.get(call.key)
        if (kept !== undefined) return Promise.resolve(kept.subject)
        const refusal = left.get(effect.id)?.shift()
        if (refusal !== undefined) return Promise.resolve(refusal)
        acted.push({ id: effect.id, payload })
        const subject = { kind: effect.id, id: `${effect.id}#${acted.length}` }
        if (!isRefused(subject)) ledger.set(call.key, { effect: effect.id, subject })
        return Promise.resolve(subject)
    }
    return { acted, ledger, execute }
}

/** What the model was asked in the latest attempt, in order. */
const asked: Array<NodeModelRequest> = []

/** One attempt of the step, under the one step key, with the model's turns scripted. */
const attempt = (world: ReturnType<typeof worldOf>, model: ReadonlyArray<unknown>, turn: TurnRef = EXAMPLE_TURN) => {
    const ports: NodeHostPorts = { ...scriptedNodePorts({ model }).ports, execute: world.execute }
    asked.length = 0
    const json: NodeHostPorts["model"]["json"] = (schema, request) => {
        asked.push(request)
        return ports.model.json(schema, request)
    }
    return runNode(
        {
            node: stepNode,
            params: {},
            input: { leadId: "l-1" },
            turn,
            grant: {},
            effects: new Map(EFFECTS.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "run-1:create-order",
        },
        { ...ports, model: { ...ports.model, json } },
    )
}

const call = (tool: string, args: Readonly<Record<string, unknown>>) => ({ call: { tool, args } })
const CREATE = call("nivo.tool.order.create", { leadId: "l-1" })
const HOLD = call("nivo.tool.customer.message.send", {
    conversationId: "c-1",
    text: "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.",
})
const ASK = { confused: { reason: "over the threshold", question: "Duy\u1ec7t \u0111\u01a1n n\u00e0y kh\u00f4ng?" } }

describe("a step that runs again after the founder's answer", () => {
    it("confirm after 'duy\u1ec7t': the confirm is really made, never answered with the stored holding message", async () => {
        const world = worldOf()
        const first = await attempt(world, [CREATE, HOLD, ASK]).catch((cause: unknown) => cause)
        expect(isNodeConfused(first)).toBe(true)

        const ran = await attempt(world, [
            CREATE,
            call("nivo.tool.order.confirm", { orderId: "nivo.tool.order.create#1" }),
            { done: { orderId: "nivo.tool.order.create#1" } },
        ])

        expect(world.acted.map((one) => one.id)).toEqual([
            "nivo.tool.order.create",
            "nivo.tool.customer.message.send",
            "nivo.tool.order.confirm",
        ])
        expect(ran.effects).toEqual([
            {
                id: "nivo.tool.order.create",
                subject: { kind: "nivo.tool.order.create", id: "nivo.tool.order.create#1" },
            },
            {
                id: "nivo.tool.order.confirm",
                subject: { kind: "nivo.tool.order.confirm", id: "nivo.tool.order.confirm#3" },
            },
        ])
    })

    it("a QR after a refusal: the refused call kept nothing, and the call made again is not answered with the holding message", async () => {
        const world = worldOf({ "nivo.tool.payment.transfer.create": [{ kind: "refused", id: "order_not_payable" }] })
        const qr = call("nivo.tool.payment.transfer.create", { orderId: "o-1" })
        await expect(attempt(world, [qr, HOLD, ASK])).rejects.toBeDefined()

        const ran = await attempt(world, [qr, { done: { orderId: "o-1" } }])

        expect(world.acted.map((one) => one.id)).toEqual([
            "nivo.tool.customer.message.send",
            "nivo.tool.payment.transfer.create",
        ])
        expect(ran.effects).toEqual([
            {
                id: "nivo.tool.payment.transfer.create",
                subject: { kind: "nivo.tool.payment.transfer.create", id: "nivo.tool.payment.transfer.create#2" },
            },
        ])
    })

    it("no double customer message: the same send asked again is answered from the first, whatever its place in the attempt", async () => {
        const world = worldOf()
        await expect(attempt(world, [CREATE, HOLD, ASK])).rejects.toBeDefined()

        await attempt(world, [HOLD, CREATE, HOLD, { done: { orderId: "nivo.tool.order.create#1" } }])

        expect(world.acted.map((one) => one.id)).toEqual(["nivo.tool.order.create", "nivo.tool.customer.message.send"])
    })

    it("the same tool with other arguments is another call, and equal arguments in another member order are the same call", async () => {
        const world = worldOf()
        await attempt(world, [
            HOLD,
            call("nivo.tool.customer.message.send", {
                text: "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.",
                conversationId: "c-1",
            }),
            call("nivo.tool.customer.message.send", {
                conversationId: "c-1",
                text: "\u0110\u01a1n c\u1ee7a m\u00ecnh \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t \u1ea1.",
            }),
            { done: { orderId: "o-1" } },
        ])

        expect(world.acted.map((one) => one.payload.text)).toEqual([
            "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.",
            "\u0110\u01a1n c\u1ee7a m\u00ecnh \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t \u1ea1.",
        ])
        expect([...world.ledger.keys()].every((key) => key.startsWith("run-1:create-order:"))).toBe(true)
        expect(new Set([...world.ledger.keys()]).size).toBe(2)
    })
})

describe("one call key for both roads", () => {
    it("an effect and a tool call of the same id and arguments get the same key, so they reach one ledger line", async () => {
        const world = worldOf()
        await attempt(world, [CREATE, { done: { orderId: "o-1" } }])
        const [effectKey] = [...world.ledger.keys()]

        const tool = defineTool({
            id: "nivo.tool.order.create",
            title: { key: "t" },
            args: z.object({ leadId: z.string() }),
            result: z.object({ orderId: z.string() }),
            mutates: true,
        })
        const toolNode = defineNode({
            ...stepNode,
            effects: [],
            tools: ["nivo.tool.order.create"],
            run: (input, context) =>
                context.tools.call<{ orderId: string }>("nivo.tool.order.create", { leadId: input.leadId }),
            examples: [
                {
                    name: "creates the order",
                    params: {},
                    input: { leadId: "l-1" },
                    output: { orderId: "o-1" },
                    effects: [],
                    tools: [{ orderId: "o-1" }],
                },
            ],
        })
        const fake = scriptedNodePorts({ tools: [{ orderId: "o-1" }] })
        await runNode(
            {
                node: toolNode,
                params: {},
                input: { leadId: "l-1" },
                turn: EXAMPLE_TURN,
                grant: { tools: ["nivo.tool.order.create"] },
                effects: new Map(),
                tools: new Map([[tool.id, tool]]),
                key: "run-1:create-order",
            },
            fake.ports,
        )

        expect(effectKey).toBeDefined()
        expect(fake.toolCalls.map((one) => one.key)).toEqual([effectKey])
    })
})

describe("what the turn tells the agent of a step", () => {
    it("puts the guidance first, in front of the goal, and the lines the step already sent in the data", async () => {
        const turn: TurnRef = {
            ...EXAMPLE_TURN,
            guidance:
                "CH\u00cdNH S\u00c1CH: \u0111\u01a1n t\u1eeb ng\u01b0\u1ee1ng duy\u1ec7t tr\u1edf l\u00ean c\u1ea7n ch\u1ee7 ti\u1ec7m duy\u1ec7t.",
            founderAnswers: [{ text: "duy\u1ec7t", at: "2026-11-10T03:00:00.000Z" }],
            alreadySent: [{ text: "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.", at: "2026-11-10T02:59:00.000Z" }],
        }
        await attempt(worldOf(), [{ done: { orderId: "o-1" } }], turn)

        const [first] = asked
        expect(
            first?.instructions.startsWith(
                "CH\u00cdNH S\u00c1CH: \u0111\u01a1n t\u1eeb ng\u01b0\u1ee1ng duy\u1ec7t tr\u1edf l\u00ean c\u1ea7n ch\u1ee7 ti\u1ec7m duy\u1ec7t.\n\n",
            ),
        ).toBe(true)
        expect(first?.volatile).toContain("`alreadySent`")
        expect(first?.volatile).toContain("`founderAnswers`")
        expect(first?.instructions).not.toContain("`alreadySent`")
        expect(first?.input).toMatchObject({
            alreadySent: [{ text: "D\u1ea1 shop \u0111ang ki\u1ec3m tra \u1ea1.", at: "2026-11-10T02:59:00.000Z" }],
            founderAnswers: [{ text: "duy\u1ec7t", at: "2026-11-10T03:00:00.000Z" }],
        })
    })

    it("says nothing of sent lines the turn does not carry, and guides a host's own call the same way", async () => {
        await attempt(worldOf(), [{ done: { orderId: "o-1" } }])
        expect(asked[0]?.volatile).toBeUndefined()
        expect(asked[0]?.input).not.toHaveProperty("alreadySent")

        const plain = { purpose: "core", instructions: "Decide.", input: {} }
        const none = { turn: EXAMPLE_TURN, effects: new Map(), tools: new Map() }
        expect(guidedModelRequest(none, plain)).toBe(plain)
        expect(guidedModelRequest({ ...none, turn: { ...EXAMPLE_TURN, guidance: "G" } }, plain).instructions).toBe(
            "G\n\nDecide.",
        )
    })
})
