import { z } from "../schema/zod-entry"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import { defineEffect } from "./effect"
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
    defineEffect({ id, title: { key: "t" }, payload, rights: [] })

const EFFECTS = [
    effectOf("order.create", z.object({ leadId: z.string() })),
    effectOf("order.confirm", z.object({ orderId: z.string() })),
    effectOf("payment.qr.create", z.object({ orderId: z.string() })),
    effectOf("customer.message.send", z.object({ conversationId: z.string(), text: z.string() })),
]

const OUTPUT = z.object({ orderId: z.string() })

const stepNode = defineNode({
    id: "sales.create-order",
    role: "output",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ leadId: z.string() }),
    output: OUTPUT,
    rights: [],
    effects: ["order.create", "order.confirm", "payment.qr.create", "customer.message.send"],
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
            effects: ["order.create"],
            model: [{ call: { tool: "order.create", args: { leadId: "l-1" } } }, { done: { orderId: "o-1" } }],
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
            grant: { rights: [] },
            effects: new Map(EFFECTS.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "run-1:create-order",
        },
        { ...ports, model: { ...ports.model, json } },
    )
}

const call = (tool: string, args: Readonly<Record<string, unknown>>) => ({ call: { tool, args } })
const CREATE = call("order.create", { leadId: "l-1" })
const HOLD = call("customer.message.send", { conversationId: "c-1", text: "Dạ shop đang kiểm tra ạ." })
const ASK = { confused: { reason: "over the threshold", question: "Duyệt đơn này không?" } }

describe("a step that runs again after the founder's answer", () => {
    it("confirm after 'duyệt': the confirm is really made, never answered with the stored holding message", async () => {
        const world = worldOf()
        const first = await attempt(world, [CREATE, HOLD, ASK]).catch((cause: unknown) => cause)
        expect(isNodeConfused(first)).toBe(true)

        const ran = await attempt(world, [
            CREATE,
            call("order.confirm", { orderId: "order.create#1" }),
            { done: { orderId: "order.create#1" } },
        ])

        expect(world.acted.map((one) => one.id)).toEqual(["order.create", "customer.message.send", "order.confirm"])
        expect(ran.effects).toEqual([
            { id: "order.create", subject: { kind: "order.create", id: "order.create#1" } },
            { id: "order.confirm", subject: { kind: "order.confirm", id: "order.confirm#3" } },
        ])
    })

    it("a QR after a refusal: the refused call kept nothing, and the call made again is not answered with the holding message", async () => {
        const world = worldOf({ "payment.qr.create": [{ kind: "refused", id: "order_not_payable" }] })
        const qr = call("payment.qr.create", { orderId: "o-1" })
        await attempt(world, [qr, HOLD, ASK]).catch(() => undefined)

        const ran = await attempt(world, [qr, { done: { orderId: "o-1" } }])

        expect(world.acted.map((one) => one.id)).toEqual(["customer.message.send", "payment.qr.create"])
        expect(ran.effects).toEqual([{ id: "payment.qr.create", subject: { kind: "payment.qr.create", id: "payment.qr.create#2" } }])
    })

    it("no double customer message: the same send asked again is answered from the first, whatever its place in the attempt", async () => {
        const world = worldOf()
        await attempt(world, [CREATE, HOLD, ASK]).catch(() => undefined)

        await attempt(world, [HOLD, CREATE, HOLD, { done: { orderId: "order.create#1" } }])

        expect(world.acted.map((one) => one.id)).toEqual(["order.create", "customer.message.send"])
    })

    it("the same tool with other arguments is another call, and equal arguments in another member order are the same call", async () => {
        const world = worldOf()
        await attempt(world, [
            HOLD,
            call("customer.message.send", { text: "Dạ shop đang kiểm tra ạ.", conversationId: "c-1" }),
            call("customer.message.send", { conversationId: "c-1", text: "Đơn của mình đã được duyệt ạ." }),
            { done: { orderId: "o-1" } },
        ])

        expect(world.acted.map((one) => one.payload.text)).toEqual(["Dạ shop đang kiểm tra ạ.", "Đơn của mình đã được duyệt ạ."])
        expect([...world.ledger.keys()].every((key) => key.startsWith("run-1:create-order:"))).toBe(true)
        expect(new Set([...world.ledger.keys()]).size).toBe(2)
    })
})

describe("what the turn tells the agent of a step", () => {
    it("puts the policy's guidance first and its values for the shop in front of the goal, and the lines the step already sent in the data", async () => {
        const turn: TurnRef = {
            ...EXAMPLE_TURN,
            guidance: "CHÍNH SÁCH: đơn từ ngưỡng duyệt trở lên cần chủ tiệm duyệt.",
            policy: { approvalThresholdVnd: 3_000_000 },
            founderAnswers: [{ text: "duyệt", at: "2026-11-10T03:00:00.000Z" }],
            alreadySent: [{ text: "Dạ shop đang kiểm tra ạ.", at: "2026-11-10T02:59:00.000Z" }],
        }
        await attempt(worldOf(), [{ done: { orderId: "o-1" } }], turn)

        const [first] = asked
        expect(first?.instructions.startsWith("CHÍNH SÁCH: đơn từ ngưỡng duyệt trở lên cần chủ tiệm duyệt.\n\n")).toBe(true)
        expect(first?.instructions).toContain('{"approvalThresholdVnd":3000000}')
        expect(first?.instructions.indexOf('{"approvalThresholdVnd":3000000}')).toBeLessThan(
            first?.instructions.indexOf("Create the order.") ?? -1,
        )
        expect(first?.volatile).toContain("`alreadySent`")
        expect(first?.volatile).toContain("`founderAnswers`")
        expect(first?.instructions).not.toContain("`alreadySent`")
        expect(first?.input).toMatchObject({
            alreadySent: [{ text: "Dạ shop đang kiểm tra ạ.", at: "2026-11-10T02:59:00.000Z" }],
            founderAnswers: [{ text: "duyệt", at: "2026-11-10T03:00:00.000Z" }],
        })
    })

    it("says nothing of a policy or of sent lines the turn does not carry, and guides a host's own call the same way", async () => {
        await attempt(worldOf(), [{ done: { orderId: "o-1" } }])
        expect(asked[0]?.instructions).not.toContain("The values of this policy")
        expect(asked[0]?.volatile).toBeUndefined()
        expect(asked[0]?.input).not.toHaveProperty("alreadySent")

        const plain = { purpose: "core", instructions: "Decide.", input: {} }
        const none = { turn: EXAMPLE_TURN, effects: new Map(), tools: new Map() }
        expect(guidedModelRequest(none, plain)).toBe(plain)
        expect(
            guidedModelRequest({ ...none, turn: { ...EXAMPLE_TURN, guidance: "G", policy: { refund: "never" } } }, plain)
                .instructions,
        ).toMatch(/^G\n\n[^\n]+\n\{"refund":"never"\}\n\nDecide\.$/)
    })
})
