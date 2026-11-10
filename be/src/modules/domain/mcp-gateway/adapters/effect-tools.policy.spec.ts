import { Test } from "@nestjs/testing"
import { z } from "zod"
import { defineEffect } from "@nivo-lite/agent-sdk/node"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import {
    answerOf,
    EFFECT_TOOL_TIMEOUT_MS,
    effectAddressOf,
    effectManifestsOf,
    jsonOf,
    refusalOf,
    refusalOfThrow,
} from "./effect-tools.policy"

/** The members of the subject under test. */
interface Subject {
    readonly answerOf: typeof answerOf
    readonly effectAddressOf: typeof effectAddressOf
    readonly effectManifestsOf: typeof effectManifestsOf
    readonly jsonOf: typeof jsonOf
    readonly refusalOf: typeof refusalOf
    readonly refusalOfThrow: typeof refusalOfThrow
}

const SUBJECT = Symbol("effect-tools.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { answerOf, effectAddressOf, effectManifestsOf, jsonOf, refusalOf, refusalOfThrow },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ORDER_CREATE = defineEffect({
    id: "order.create",
    title: { key: "orderCreate" },
    payload: z.object({ leadId: z.string().min(1), qty: z.number().int().positive() }).strict(),
    rights: [],
})
const ORDER_CONFIRM = defineEffect({
    id: "order.confirm",
    title: { key: "orderConfirm" },
    payload: z.object({ orderId: z.string().min(1) }).strict(),
    rights: [],
})
const MESSAGE_SEND = defineEffect({
    id: "customer.message.send",
    title: { key: "customerMessageSend" },
    payload: z.object({ conversationId: z.string(), text: z.string() }).strict(),
    rights: [],
})

describe("effect-tools.policy", () => {
    it("splits an effect id at its first dot into connector and tool", async () => {
        const subject = await build()

        expect(subject.effectAddressOf("customer.message.send")).toEqual({
            connector: "customer",
            tool: "message.send",
        })
        expect(subject.effectAddressOf("order.create")).toEqual({ connector: "order", tool: "create" })
        expect(subject.effectAddressOf("plain")).toBeNull()
        expect(subject.effectAddressOf("order.")).toBeNull()
    })

    it("declares one write connector per effect domain, granted by the step, ledgered and out of the taint rule", async () => {
        const subject = await build()

        const manifests = subject.effectManifestsOf([ORDER_CREATE, MESSAGE_SEND, ORDER_CONFIRM])

        expect(manifests.map((manifest) => [manifest.key, manifest.tools.map((spec) => spec.name)])).toEqual([
            ["order", ["create", "confirm"]],
            ["customer", ["message.send"]],
        ])
        const [order] = manifests
        expect(order).toMatchObject({ kind: "native", timeoutMs: EFFECT_TOOL_TIMEOUT_MS })
        expect(order?.tools[0]).toMatchObject({
            scope: "write",
            ledgered: true,
            stepGranted: true,
            taintExempt: true,
            inputSchema: { type: "object", properties: { leadId: { type: "string" } } },
        })
        expect(order?.tools[0]?.internalOnly).toBeUndefined()
    })

    it("validates arguments with the effect's own payload schema", async () => {
        const subject = await build()
        const [order] = subject.effectManifestsOf([ORDER_CREATE])
        const schema = order?.tools[0]?.argumentSchema

        expect(schema?.safeParse({ leadId: "lead-1", qty: 2 }).success).toBe(true)
        expect(schema?.safeParse({ leadId: "lead-1", qty: 2, amountVnd: 1 }).success).toBe(false)
        expect(schema?.safeParse({ leadId: "", qty: 2 }).success).toBe(false)
    })

    it("answers a fact as JSON the gateway carries", async () => {
        const subject = await build()
        const at = new Date("2026-11-10T01:00:00.000Z")

        expect(
            subject.answerOf({ kind: "order", id: "o-1", facts: { amountVnd: 5, at, gone: undefined, bad: Number.NaN } }),
        ).toEqual({ kind: "order", id: "o-1", facts: { amountVnd: 5, at: "2026-11-10T01:00:00.000Z", bad: null } })
        expect(subject.answerOf({ kind: "message", id: "m-1" })).toEqual({ kind: "message", id: "m-1" })
        expect(subject.jsonOf([1, "a", true, null, Symbol.iterator])).toEqual([1, "a", true, null, null])
    })

    it("answers a typed throw as a refusal fact with its code and params, and nothing for any other throw", async () => {
        const subject = await build()
        const typed = new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason: "held" } })

        expect(subject.refusalOfThrow(typed)).toEqual({
            kind: "refused",
            id: McpGatewayErrorCode.NativeRefused,
            facts: { reason: "held" },
        })
        expect(subject.refusalOfThrow(new Error("db down"))).toBeNull()
        expect(subject.refusalOf("no_run")).toEqual({ kind: "refused", id: "no_run" })
    })
})
